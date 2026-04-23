import { OrderRepository } from "@/repositories/OrderRepository";
import { ProductRepository } from "@/repositories/ProductRepository";
import { IntegrationLogRepository } from "@/repositories/IntegrationLogRepository";
import { getPaymentProvider } from "@/integrations/payment/PaymentProviderFactory";
import type { OrderCreate } from "@/entities/order";
import { ValidationError, PaymentError } from "@/shared/errors";
import { createLogger } from "@/shared/logger";
import { SITE_URL } from "@/shared/constants";

const logger = createLogger("OrderService");

function generateOrderNumber(): string {
  const date = new Date();
  const prefix = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

export class OrderService {
  static async createOrder(input: OrderCreate) {
    // Idempotency check
    const existing = await OrderRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      logger.info("Duplicate order attempt blocked", {
        idempotencyKey: input.idempotencyKey,
        existingOrderId: existing.id,
      });
      return existing;
    }

    // Validate products and build line items
    const productIds = input.items.map((i) => i.productId);
    const products = await ProductRepository.findByIds(productIds);
    const productMap = new Map(products.map((p) => [p.id, p]));

    const orderItems = [];
    let subtotal = 0;

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new ValidationError(`Товар не знайдено: ${item.productId}`);
      }
      if (product.stockStatus !== "in_stock") {
        throw new ValidationError(`Товар "${product.name}" немає в наявності`);
      }
      if (product.quantity !== null && product.quantity < item.quantity) {
        throw new ValidationError(
          `Товар "${product.name}" — доступно лише ${product.quantity} шт.`
        );
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

    const total = subtotal; // No delivery cost / discounts in MVP

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
      total,
      idempotencyKey: input.idempotencyKey,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      utmTerm: input.utmTerm,
      utmContent: input.utmContent,
      items: orderItems,
    });

    logger.info("Order created", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
    });

    return order;
  }

  static async createPaymentForOrder(orderId: string) {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new PaymentError("Замовлення не знайдено");

    const provider = getPaymentProvider("wayforpay");

    const session = await provider.createPaymentSession({
      orderNumber: order.orderNumber,
      amount: order.total,
      currency: order.currency,
      description: `Замовлення ${order.orderNumber}`,
      returnUrl: `${SITE_URL}/checkout/success?order=${order.orderNumber}`,
      callbackUrl: `${SITE_URL}/api/payment/callback`,
      customerEmail: order.customerEmail || undefined,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    });

    await IntegrationLogRepository.create({
      integration: "wayforpay",
      direction: "outbound",
      method: "POST",
      endpoint: "createPaymentSession",
      entityType: "order",
      entityId: order.id,
      requestBody: JSON.stringify({
        orderNumber: order.orderNumber,
        amount: order.total,
      }),
      responseStatus: 200,
    });

    return session;
  }

  static async handlePaymentCallback(rawBody: string, headers: Record<string, string>) {
    const provider = getPaymentProvider("wayforpay");

    const result = await provider.verifyCallback({
      provider: "wayforpay",
      rawBody,
      headers,
    });

    // Log the callback
    await IntegrationLogRepository.create({
      integration: "wayforpay",
      direction: "inbound",
      method: "WEBHOOK",
      endpoint: "payment/callback",
      entityType: "order",
      entityId: result.orderNumber,
      requestBody: rawBody,
      responseStatus: result.signatureValid ? 200 : 401,
      errorMessage: result.signatureValid ? undefined : "Invalid signature",
    });

    if (!result.signatureValid) {
      logger.warn("Invalid payment webhook signature", {
        orderNumber: result.orderNumber,
      });
      return { accepted: false };
    }

    // Find order
    const order = await OrderRepository.findByOrderNumber(result.orderNumber);
    if (!order) {
      logger.error("Order not found for payment callback", {
        orderNumber: result.orderNumber,
      });
      return { accepted: false };
    }

    // Idempotency: if already paid, skip
    if (order.paymentStatus === "paid") {
      logger.info("Payment already processed", {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
      return { accepted: true };
    }

    // Record payment event
    const { prisma } = await import("@/shared/db");
    await prisma.paymentEvent.create({
      data: {
        orderId: order.id,
        provider: result.success ? "wayforpay" : "wayforpay",
        eventType: result.success ? "success" : "failure",
        externalId: result.externalPaymentId,
        amount: result.amount,
        currency: result.currency,
        rawPayload: result.rawPayload,
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

      // Mark for KeyCRM sync
      await OrderRepository.updateKeycrmSync(order.id, {
        keycrmSyncStatus: "pending",
      });

      logger.info("Payment successful", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: result.amount,
      });
    } else {
      await OrderRepository.updatePaymentStatus(order.id, {
        paymentStatus: "failed",
      });

      logger.warn("Payment failed", {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }

    return { accepted: true };
  }
}
