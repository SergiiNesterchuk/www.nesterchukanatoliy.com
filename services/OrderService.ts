import { OrderRepository } from "@/repositories/OrderRepository";
import { ProductRepository } from "@/repositories/ProductRepository";
import { IntegrationLogRepository } from "@/repositories/IntegrationLogRepository";
import { getPaymentProvider } from "@/integrations/payment/PaymentProviderFactory";
import type { OrderCreate } from "@/entities/order";
import { ValidationError, PaymentError } from "@/shared/errors";
import { createLogger } from "@/shared/logger";
import { buildAbsoluteUrl } from "@/shared/url";
import { generatePublicOrderNumber } from "@/shared/order-number";
import { generateOrderAccessToken } from "@/shared/access-token";
import { isMockPayments, crmSyncEnabled } from "@/shared/features";

const logger = createLogger("OrderService");

function generateInternalOrderRef(): string {
  const date = new Date();
  const prefix = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

export class OrderService {
  static async createOrder(input: OrderCreate) {
    const existing = await OrderRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      logger.info("Duplicate order blocked by idempotency", { idempotencyKey: input.idempotencyKey });
      return existing;
    }

    const productIds = input.items.map((i) => i.productId);
    const products = await ProductRepository.findByIds(productIds);
    const productMap = new Map(products.map((p) => [p.id, p]));

    const orderItems = [];
    let subtotal = 0;

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) throw new ValidationError(`Товар не знайдено: ${item.productId}`);
      if (product.stockStatus !== "in_stock") throw new ValidationError(`"${product.name}" немає в наявності`);
      if (product.quantity !== null && product.quantity < item.quantity) {
        throw new ValidationError(`"${product.name}" — доступно лише ${product.quantity} шт.`);
      }

      const lineTotal = product.price * item.quantity;
      subtotal += lineTotal;

      orderItems.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: item.quantity,
        lineTotal,
        imageUrl: product.images[0]?.url,
      });
    }

    // Generate both internal ref (for WayForPay) and public number (for customer)
    let publicNumber: string;
    try {
      publicNumber = await generatePublicOrderNumber();
    } catch {
      publicNumber = generateInternalOrderRef(); // fallback
    }

    const order = await OrderRepository.create({
      orderNumber: publicNumber,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      deliveryMethod: input.deliveryMethod,
      deliveryCity: input.deliveryCity,
      deliveryAddress: input.deliveryAddress,
      deliveryBranchRef: input.deliveryBranchRef,
      deliveryBranchName: input.deliveryBranchName,
      comment: input.comment,
      paymentMethod: input.paymentMethod,
      subtotal,
      total: subtotal,
      idempotencyKey: input.idempotencyKey,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      utmTerm: input.utmTerm,
      utmContent: input.utmContent,
      items: orderItems,
    });

    // Create or find Customer by phone
    try {
      const { prisma } = await import("@/shared/db");
      const normalizedPhone = input.customerPhone;
      const customer = await prisma.customer.upsert({
        where: { phoneNormalized: normalizedPhone },
        update: { name: input.customerName, email: input.customerEmail || undefined },
        create: { phoneNormalized: normalizedPhone, name: input.customerName, email: input.customerEmail || undefined },
      });
      // Generate access token for order status link (used in emails)
      const accessToken = generateOrderAccessToken();
      await prisma.order.update({
        where: { id: order.id },
        data: {
          customerId: customer.id,
          accessTokenHash: accessToken.hash,
          accessTokenExpiresAt: accessToken.expiresAt,
        },
      });
      // Store raw token temporarily on order object for email use
      (order as Record<string, unknown>)._accessToken = accessToken.token;

      // Record initial status
      await prisma.orderStatusHistory.create({
        data: { orderId: order.id, source: "local", newStatus: "new", message: "Замовлення створено" },
      });
    } catch (e) {
      logger.warn("Customer/history creation failed", { error: e instanceof Error ? e.message : String(e) });
    }

    // Decrement product stock quantities
    try {
      const { prisma } = await import("@/shared/db");
      for (const item of input.items) {
        const product = productMap.get(item.productId);
        if (product && product.quantity !== null) {
          const newQty = product.quantity - item.quantity;
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              quantity: Math.max(0, newQty),
              ...(newQty <= 0 ? { stockStatus: "out_of_stock" } : {}),
            },
          });
        }
      }
    } catch (e) {
      logger.warn("Stock decrement failed", { orderId: order.id, error: e instanceof Error ? e.message : String(e) });
    }

    logger.info("Order created", { orderId: order.id, orderNumber: order.orderNumber, total: order.total });
    return order;
  }

  /**
   * Create WayForPay payment session.
   * @param orderId - local order ID
   * @param overrideAmount - optional: pay this amount instead of order.total (for COD prepayment)
   */
  static async createPaymentForOrder(orderId: string, overrideAmount?: number) {
    if (isMockPayments || !process.env.WAYFORPAY_MERCHANT_ACCOUNT || process.env.PAYMENTS_ENABLED === "false") {
      logger.info("Payments disabled or mock mode, skipping WayForPay", { orderId, mode: isMockPayments ? "mock" : "disabled" });
      return null;
    }

    const order = await OrderRepository.findById(orderId);
    if (!order) throw new PaymentError("Замовлення не знайдено");

    const payAmount = overrideAmount || order.total;
    const isCodPrepayment = !!overrideAmount && overrideAmount < order.total;

    const description = isCodPrepayment
      ? `Передплата ${payAmount / 100} грн за замовлення ${order.orderNumber}`
      : `Замовлення ${order.orderNumber}`;

    const provider = getPaymentProvider("wayforpay");

    const returnUrl = buildAbsoluteUrl(`/api/payment/return?order=${order.orderNumber}`);
    const callbackUrl = buildAbsoluteUrl("/api/payment/callback");

    logger.info("Creating WayForPay session", {
      orderNumber: order.orderNumber,
      amount: payAmount,
      purpose: isCodPrepayment ? "cod_prepayment" : "full_payment",
      returnUrl,
      callbackUrl,
    });

    const session = await provider.createPaymentSession({
      orderNumber: order.orderNumber,
      amount: payAmount,
      currency: order.currency,
      description,
      returnUrl,
      callbackUrl,
      customerEmail: order.customerEmail || undefined,
      // For prepayment: single line item with prepayment amount
      items: isCodPrepayment
        ? [{ name: `Передплата за замовлення ${order.orderNumber}`, quantity: 1, price: payAmount }]
        : order.items.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })),
    });

    await IntegrationLogRepository.create({
      integration: "wayforpay",
      direction: "outbound",
      method: "POST",
      endpoint: "createPaymentSession",
      entityType: "order",
      entityId: order.id,
    });

    return session;
  }

  /**
   * Mock payment: simulate a successful payment through the same status update
   * path as a real WayForPay callback. Creates PaymentEvent, updates order status,
   * triggers email notification. CRM sync respects crmSyncEnabled flag.
   *
   * Only works when PAYMENTS_MODE=mock or PAYMENTS_ENABLED=false.
   */
  static async applyMockPayment(orderId: string, overrideAmount?: number) {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new PaymentError("Order not found for mock payment");

    const amount = overrideAmount || order.total;
    const isCodPrepayment = order.paymentPurpose === "cod_prepayment" || order.paymentMethod.includes("cod");
    const newPaymentStatus = isCodPrepayment ? "partial_paid" : "paid";
    const mockTxId = `MOCK-${Date.now()}`;

    const { prisma } = await import("@/shared/db");

    // PaymentEvent — same as real callback
    await prisma.paymentEvent.create({
      data: {
        orderId: order.id,
        provider: "mock",
        eventType: "success",
        externalId: mockTxId,
        amount,
        currency: order.currency,
        rawPayload: JSON.stringify({ mock: true, timestamp: new Date().toISOString() }),
        signatureValid: true,
      },
    });

    // Update order — same fields as real callback
    await OrderRepository.updatePaymentStatus(order.id, {
      paymentStatus: newPaymentStatus,
      paymentProvider: "mock",
      externalPaymentId: mockTxId,
      status: isCodPrepayment ? "new" : "paid",
    });

    // Status history
    const statusMessage = isCodPrepayment
      ? `[MOCK] Передплату ${(amount / 100).toFixed(0)} грн отримано`
      : "[MOCK] Оплату отримано";
    await prisma.orderStatusHistory.create({
      data: { orderId: order.id, source: "payment", oldStatus: order.paymentStatus, newStatus: newPaymentStatus, message: statusMessage },
    }).catch(() => {});

    // Email notification — same as real callback (allows testing email templates)
    import("@/services/NotificationService").then(({ NotificationService }) => {
      OrderRepository.findById(order.id).then((updatedOrder) => {
        if (updatedOrder) {
          NotificationService.sendOrderConfirmation(updatedOrder).catch((e) => {
            logger.error("Mock email notification failed", { orderId: order.id, error: e instanceof Error ? e.message : String(e) });
          });
        }
      });
    });

    logger.info("Mock payment applied", { orderId: order.id, orderNumber: order.orderNumber, amount, status: newPaymentStatus });
  }

  static async handlePaymentCallback(rawBody: string, headers: Record<string, string>) {
    const provider = getPaymentProvider("wayforpay");

    const result = await provider.verifyCallback({ provider: "wayforpay", rawBody, headers });

    await IntegrationLogRepository.create({
      integration: "wayforpay",
      direction: "inbound",
      method: "WEBHOOK",
      endpoint: "payment/callback",
      entityType: "order",
      entityId: result.orderNumber,
      requestBody: rawBody.substring(0, 5000),
      responseStatus: result.signatureValid ? 200 : 401,
      errorMessage: result.signatureValid ? undefined : "Invalid signature",
    });

    if (!result.signatureValid) {
      logger.warn("Invalid payment webhook signature", { orderNumber: result.orderNumber });
      return { accepted: false, orderNumber: result.orderNumber };
    }

    const order = await OrderRepository.findByOrderNumber(result.orderNumber);
    if (!order) {
      logger.error("Order not found for payment callback", { orderNumber: result.orderNumber });
      return { accepted: false, orderNumber: result.orderNumber };
    }

    if (order.paymentStatus === "paid" && result.status === "success") {
      return { accepted: true, orderNumber: result.orderNumber };
    }

    const { prisma } = await import("@/shared/db");
    await prisma.paymentEvent.create({
      data: {
        orderId: order.id,
        provider: "wayforpay",
        eventType: result.success ? "success" : "failure",
        externalId: result.externalPaymentId,
        amount: result.amount,
        currency: result.currency,
        rawPayload: result.rawPayload.substring(0, 10000),
        signatureValid: result.signatureValid,
      },
    });

    if (result.success) {
      // Determine payment status based on payment purpose
      const isCodPrepayment = order.paymentPurpose === "cod_prepayment" || order.paymentMethod.includes("cod");
      const newPaymentStatus = isCodPrepayment ? "partial_paid" : "paid";
      const statusMessage = isCodPrepayment
        ? `Передплату ${(result.amount / 100).toFixed(0)} грн отримано`
        : "Оплату отримано";

      await OrderRepository.updatePaymentStatus(order.id, {
        paymentStatus: newPaymentStatus,
        paymentProvider: "wayforpay",
        externalPaymentId: result.externalPaymentId,
        status: isCodPrepayment ? "new" : "paid",
      });

      // Status history
      try {
        await prisma.orderStatusHistory.create({
          data: { orderId: order.id, source: "payment", oldStatus: order.paymentStatus, newStatus: newPaymentStatus, message: statusMessage },
        });
      } catch { /* non-critical */ }

      if (crmSyncEnabled) {
        import("@/services/KeyCRMService").then(({ KeyCRMService }) => {
          const service = new KeyCRMService();
          // COD prepayment → спеціальна фун��ція з двома payments (prepayment + remainder)
          const syncFn = isCodPrepayment
            ? service.syncCodPrepaymentToKeyCRM(order.id)
            : service.syncPaymentToKeyCRM(order.id);
          syncFn.catch((e) => {
            logger.error("KeyCRM payment sync failed", { orderId: order.id, error: e instanceof Error ? e.message : String(e) });
          });
        });
      }

      logger.info("Payment successful", { orderId: order.id, orderNumber: order.orderNumber });

      // Send email notification (non-blocking, idempotent)
      import("@/services/NotificationService").then(({ NotificationService }) => {
        // Refetch order with updated status and items
        OrderRepository.findById(order.id).then((updatedOrder) => {
          if (updatedOrder) {
            NotificationService.sendOrderConfirmation(updatedOrder).catch((e) => {
              logger.error("Email notification failed", { orderId: order.id, error: e instanceof Error ? e.message : String(e) });
            });
          }
        });
      });
    } else if (result.status === "failure") {
      // Distinguish: refund after successful charge vs declined before charge
      const wasPreviouslyCharged = ["paid", "partial_paid"].includes(order.paymentStatus);
      const isCodPrepayment = order.paymentPurpose === "cod_prepayment" || order.paymentMethod.includes("cod");

      let failStatus: string;
      let failMessage: string;

      if (wasPreviouslyCharged) {
        // Refund/cancellation AFTER money was charged
        failStatus = "refunded";
        failMessage = isCodPrepayment ? "Передплату скасовано / кошти повернено" : "Кошти повернено";
      } else {
        // Declined BEFORE charge
        failStatus = isCodPrepayment ? "prepayment_failed" : "failed";
        failMessage = isCodPrepayment ? "Передплата не пройшла" : "Оплата не пройшла";
      }

      await OrderRepository.updatePaymentStatus(order.id, { paymentStatus: failStatus });

      // Status history
      try {
        await prisma.orderStatusHistory.create({
          data: { orderId: order.id, source: "payment_callback", oldStatus: order.paymentStatus, newStatus: failStatus, message: failMessage },
        });
      } catch { /* non-critical */ }

      // Sync to KeyCRM: reversal if already synced, create if not
      if (crmSyncEnabled) {
        await OrderRepository.updateKeycrmSync(order.id, { keycrmSyncStatus: "pending" });
        import("@/services/KeyCRMService").then(({ KeyCRMService }) => {
          const service = new KeyCRMService();
          if (order.keycrmOrderId) {
            service.syncPaymentReversal(order.id).catch((e) => {
              logger.error("Reversal sync failed", { orderId: order.id, error: e instanceof Error ? e.message : String(e) });
            });
          } else {
            service.createOrder(order.id).catch((e) => {
              logger.error("CRM sync failed (unpaid)", { orderId: order.id, error: e instanceof Error ? e.message : String(e) });
            });
          }
        });
      }
    }

    return { accepted: true, orderNumber: result.orderNumber };
  }
}
