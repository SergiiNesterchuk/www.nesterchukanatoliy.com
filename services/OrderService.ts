import { OrderRepository } from "@/repositories/OrderRepository";
import { ProductRepository } from "@/repositories/ProductRepository";
import { IntegrationLogRepository } from "@/repositories/IntegrationLogRepository";
import { getPaymentProvider } from "@/integrations/payment/PaymentProviderFactory";
import type { OrderCreate } from "@/entities/order";
import { ValidationError, PaymentError } from "@/shared/errors";
import { createLogger } from "@/shared/logger";
import { buildAbsoluteUrl } from "@/shared/url";

const logger = createLogger("OrderService");

function generateOrderNumber(): string {
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

    const order = await OrderRepository.create({
      orderNumber: generateOrderNumber(),
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
      await prisma.order.update({ where: { id: order.id }, data: { customerId: customer.id } });

      // Record initial status
      await prisma.orderStatusHistory.create({
        data: { orderId: order.id, source: "local", newStatus: "new", message: "Замовлення створено" },
      });
    } catch (e) {
      logger.warn("Customer/history creation failed", { error: e instanceof Error ? e.message : String(e) });
    }

    logger.info("Order created", { orderId: order.id, orderNumber: order.orderNumber, total: order.total });
    return order;
  }

  static async createPaymentForOrder(orderId: string) {
    if (process.env.PAYMENTS_ENABLED === "false") {
      logger.info("Payments disabled, skipping", { orderId });
      return null;
    }

    const order = await OrderRepository.findById(orderId);
    if (!order) throw new PaymentError("Замовлення не знайдено");

    // Guard: COD and non-online methods must NOT create WayForPay session
    if (order.paymentMethod.includes("cod") || order.paymentStatus === "cod_pending") {
      logger.info("Skipping online payment for COD order", { orderId, paymentMethod: order.paymentMethod });
      return null;
    }

    const provider = getPaymentProvider("wayforpay");

    const session = await provider.createPaymentSession({
      orderNumber: order.orderNumber,
      amount: order.total,
      currency: order.currency,
      description: `Замовлення ${order.orderNumber}`,
      returnUrl: buildAbsoluteUrl(`/api/payment/return?order=${order.orderNumber}`),
      callbackUrl: buildAbsoluteUrl("/api/payment/callback"),
      customerEmail: order.customerEmail || undefined,
      items: order.items.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })),
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
      await OrderRepository.updatePaymentStatus(order.id, {
        paymentStatus: "paid",
        paymentProvider: "wayforpay",
        externalPaymentId: result.externalPaymentId,
        status: "paid",
      });

      // Status history
      try {
        await prisma.orderStatusHistory.create({
          data: { orderId: order.id, source: "payment", oldStatus: order.paymentStatus, newStatus: "paid", message: "Оплату отримано" },
        });
      } catch { /* non-critical */ }

      if (process.env.CRM_SYNC_ENABLED !== "false") {
        await OrderRepository.updateKeycrmSync(order.id, { keycrmSyncStatus: "pending" });
        import("@/services/KeyCRMService").then(({ KeyCRMService }) => {
          const service = new KeyCRMService();
          service.createOrder(order.id).catch((e) => {
            logger.error("Async CRM sync failed", { orderId: order.id, error: e instanceof Error ? e.message : String(e) });
          });
        });
      }

      logger.info("Payment successful", { orderId: order.id, orderNumber: order.orderNumber });
    } else if (result.status === "failure") {
      await OrderRepository.updatePaymentStatus(order.id, { paymentStatus: "failed" });

      // Sync to KeyCRM: reversal if already synced, create if not
      if (process.env.CRM_SYNC_ENABLED !== "false") {
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
