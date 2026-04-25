import { KeyCRMClient } from "@/integrations/keycrm/KeyCRMClient";
import { KeyCRMMapper } from "@/integrations/keycrm/KeyCRMMapper";
import type { KeyCRMOrderResponse, KeyCRMBuyerResponse } from "@/integrations/keycrm/types";
import { OrderRepository } from "@/repositories/OrderRepository";
import { RetryableSyncError, FatalSyncError, IntegrationError } from "@/shared/errors";
import { createLogger } from "@/shared/logger";

const logger = createLogger("KeyCRMService");

export class KeyCRMService {
  private client: KeyCRMClient;
  private sourceId: number;

  constructor() {
    this.client = new KeyCRMClient();
    this.sourceId = parseInt(process.env.KEYCRM_SOURCE_ID || "6", 10);
  }

  async findOrCreateBuyer(phone: string, name: string, email?: string): Promise<KeyCRMBuyerResponse | null> {
    try {
      // Search existing buyer by phone
      const buyers = await this.client.request<{ data: KeyCRMBuyerResponse[] }>(
        "GET",
        `/buyer?filter[phone]=${encodeURIComponent(phone)}`,
        undefined,
        "buyer",
        phone
      );

      if (buyers.data && buyers.data.length > 0) {
        return buyers.data[0];
      }

      // Create new buyer
      const newBuyer = await this.client.request<KeyCRMBuyerResponse>(
        "POST",
        "/buyer",
        { full_name: name, phone, email },
        "buyer"
      );

      return newBuyer;
    } catch (error) {
      logger.warn("Failed to find/create buyer in KeyCRM", {
        phone,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async createOrder(orderId: string): Promise<void> {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      throw new FatalSyncError(`Order not found: ${orderId}`);
    }

    // Idempotency: skip if already synced
    if (order.keycrmOrderId) {
      logger.info("Order already synced to KeyCRM", {
        orderId,
        keycrmOrderId: order.keycrmOrderId,
      });
      return;
    }

    try {
      const keycrmPayload = KeyCRMMapper.mapOrderToKeycrm(order, this.sourceId);

      const keycrmOrder = await this.client.request<KeyCRMOrderResponse>(
        "POST",
        "/order",
        keycrmPayload,
        "order",
        orderId
      );

      // Try to get payment ID from KeyCRM order (for future refund sync)
      // Works for both full_payment (paid) and cod_prepayment (partial_paid)
      let keycrmPaymentId: string | undefined;
      if (order.paymentStatus === "paid" || order.paymentStatus === "partial_paid") {
        try {
          const fullOrder = await this.client.request<{ payments?: Array<{ id: number }> }>(
            "GET",
            `/order/${keycrmOrder.id}?include=payments`,
            undefined,
            "order",
            orderId
          );
          if (fullOrder.payments && fullOrder.payments.length > 0) {
            keycrmPaymentId = String(fullOrder.payments[0].id);
          }
        } catch {
          logger.warn("Could not fetch keycrmPaymentId", { orderId });
        }
      }

      await OrderRepository.updateKeycrmSync(orderId, {
        keycrmOrderId: String(keycrmOrder.id),
        keycrmBuyerId: String(keycrmOrder.buyer_id),
        keycrmPaymentId,
        keycrmSyncStatus: "synced",
        keycrmSyncError: null,
      });

      logger.info("Order synced to KeyCRM", {
        orderId,
        keycrmOrderId: keycrmOrder.id,
        keycrmPaymentId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const details = error instanceof IntegrationError ? error.details : undefined;
      const isRetryable = (details as Record<string, unknown>)?.isRetryable !== false;

      await OrderRepository.updateKeycrmSync(orderId, {
        keycrmSyncStatus: "failed",
        keycrmSyncError: message.substring(0, 500),
        keycrmSyncRetries: { increment: 1 },
      });

      logger.error("KeyCRM sync failed", {
        orderId,
        isRetryable,
        error: message.substring(0, 300),
      });

      if (isRetryable) {
        throw new RetryableSyncError(`Failed to sync order ${orderId}: ${message}`);
      } else {
        throw new FatalSyncError(`Non-retryable sync error for ${orderId}: ${message}`);
      }
    }
  }

  /**
   * Централізована функція синхронізації оплати з KeyCRM.
   * Обробляє всі сценарії: нове замовлення, існуюче без оплати,
   * існуюче з not_paid оплатою, вже оплачене (idempotency).
   */
  async syncPaymentToKeyCRM(orderId: string): Promise<void> {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      logger.error("syncPaymentToKeyCRM: замовлення не знайдено", { orderId });
      return;
    }

    const orderNum = order.publicOrderNumber || order.orderNumber;

    // Case A: замовлення ще не в KeyCRM → створити з оплатою
    if (!order.keycrmOrderId) {
      logger.info("syncPaymentToKeyCRM: створюємо замовлення в KeyCRM з оплатою", {
        orderId, orderNumber: orderNum, action: "createOrder",
      });
      await OrderRepository.updateKeycrmSync(orderId, { keycrmSyncStatus: "pending" });
      await this.createOrder(orderId);
      return;
    }

    // Case D: оплата вже прикріплена — перевірити чи статус paid
    if (order.keycrmPaymentId) {
      // Перевірити поточний статус оплати в KeyCRM
      try {
        const keycrmOrder = await this.client.request<{ payments?: Array<{ id: number; status: string; amount: number }> }>(
          "GET",
          `/order/${order.keycrmOrderId}?include=payments`,
          undefined, "order", orderId
        );
        const existingPayment = keycrmOrder.payments?.find((p) => String(p.id) === order.keycrmPaymentId);

        if (existingPayment?.status === "paid") {
          logger.info("syncPaymentToKeyCRM: оплата вже paid в KeyCRM, пропуск", {
            orderId, orderNumber: orderNum, keycrmPaymentId: order.keycrmPaymentId, action: "skip",
          });
          return;
        }

        // Case C: оплата є, але статус не paid → оновити на paid
        if (existingPayment) {
          logger.info("syncPaymentToKeyCRM: оновлюємо статус оплати на paid", {
            orderId, orderNumber: orderNum, keycrmPaymentId: order.keycrmPaymentId,
            oldStatus: existingPayment.status, action: "updatePayment",
          });
          await this.client.request(
            "PUT",
            `/order/${order.keycrmOrderId}/payment/${order.keycrmPaymentId}`,
            { status: "paid" },
            "order", orderId
          );
          return;
        }
      } catch (e) {
        logger.warn("syncPaymentToKeyCRM: не вдалося перевірити оплату, спробуємо прикріпити нову", {
          orderId, error: e instanceof Error ? e.message : String(e),
        });
        // Продовжити до створення нової оплати
      }
    }

    // Case B: замовлення в KeyCRM, але оплати немає → прикріпити
    const paymentMethodId = KeyCRMMapper.getPaymentMethodId(order.paymentMethod);
    const amountUAH = order.total / 100;

    logger.info("syncPaymentToKeyCRM: прикріплюємо оплату", {
      orderId, orderNumber: orderNum, keycrmOrderId: order.keycrmOrderId,
      paymentMethodId, amountUAH, action: "attachPayment",
    });

    try {
      const result = await this.client.request<{ id?: number }>(
        "POST",
        `/order/${order.keycrmOrderId}/payment`,
        {
          ...(paymentMethodId ? { payment_method_id: paymentMethodId } : { payment_method: KeyCRMMapper.mapPaymentMethod(order.paymentMethod) }),
          amount: amountUAH,
          status: "paid",
          description: order.externalPaymentId
            ? `WayForPay: ${order.externalPaymentId}. Замовлення сайту: ${orderNum}`
            : `Оплата карткою. Замовлення сайту: ${orderNum}`,
        },
        "order", orderId
      );

      if (result?.id) {
        const { prisma } = await import("@/shared/db");
        await prisma.order.update({
          where: { id: orderId },
          data: { keycrmPaymentId: String(result.id) },
        });
      }

      logger.info("syncPaymentToKeyCRM: оплату прикріплено", {
        orderId, orderNumber: orderNum, keycrmOrderId: order.keycrmOrderId,
        keycrmPaymentId: result?.id, paymentMethodId, amountUAH, action: "attached",
      });

      // Верифікація: перевірити що оплата з'явилась
      try {
        const verify = await this.client.request<{ payments?: Array<{ id: number; status: string }> }>(
          "GET",
          `/order/${order.keycrmOrderId}?include=payments`,
          undefined, "order", orderId
        );
        const paidPayments = verify.payments?.filter((p) => p.status === "paid") || [];
        if (paidPayments.length === 0) {
          logger.error("syncPaymentToKeyCRM: ВЕРИФІКАЦІЯ НЕВДАЛА — оплата не знайдена після прикріплення", {
            orderId, keycrmOrderId: order.keycrmOrderId, paymentsCount: verify.payments?.length || 0,
          });
        }
      } catch { /* верифікація не критична */ }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("syncPaymentToKeyCRM: не вдалося прикріпити оплату", {
        orderId, keycrmOrderId: order.keycrmOrderId, error: msg,
      });
      // Позначити для retry
      await OrderRepository.updateKeycrmSync(orderId, {
        keycrmSyncStatus: "failed",
        keycrmSyncError: `Payment attach: ${msg.substring(0, 400)}`,
        keycrmSyncRetries: { increment: 1 },
      });
    }
  }

  /** @deprecated Використовуйте syncPaymentToKeyCRM замість attachPayment */
  async attachPayment(orderId: string): Promise<void> {
    return this.syncPaymentToKeyCRM(orderId);
  }

  /**
   * Sync payment refund/cancellation to KeyCRM.
   * Updates existing payment record or adds refund comment.
   */
  async syncPaymentRefund(orderId: string): Promise<void> {
    const order = await OrderRepository.findById(orderId);
    if (!order || !order.keycrmOrderId) return;

    // Idempotency: if already synced with final refund/failed status, skip
    if (order.keycrmSyncStatus === "synced" && ["refunded", "cancelled", "prepayment_failed"].includes(order.paymentStatus)) {
      logger.info("Refund already synced, skipping", { orderId });
      return;
    }

    // Determine refund amount: prepayment amount for COD, full total for card
    const isCodPrepayment = order.paymentPurpose === "cod_prepayment";
    const refundAmount = isCodPrepayment && order.prepaymentAmount
      ? order.prepaymentAmount
      : order.total;
    const refundLabel = isCodPrepayment ? "Передплата" : "Оплата";

    try {
      let refundSynced = false;

      // If we have keycrmPaymentId, cancel the specific payment record
      if (order.keycrmPaymentId) {
        try {
          await this.client.request(
            "PUT",
            `/order/${order.keycrmOrderId}/payment/${order.keycrmPaymentId}`,
            { status: "canceled" },
            "order",
            orderId
          );
          refundSynced = true;
          logger.info("Payment refund synced via payment update", {
            orderId,
            keycrmPaymentId: order.keycrmPaymentId,
            isCodPrepayment,
            refundAmount,
          });
        } catch (e) {
          logger.warn("Payment update endpoint failed, falling back to comment", {
            orderId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // Comment with order number, amount, and transaction details
      const orderNum = order.publicOrderNumber || order.orderNumber;
      const amountStr = (refundAmount / 100).toFixed(2);
      const txId = order.externalPaymentId || "N/A";

      const commentText = refundSynced
        ? `${refundLabel} WayForPay скасовано / кошти повернено. Замовлення сайту: ${orderNum}. Сума: ${amountStr} грн. Transaction ID: ${txId}. Фінансовий запис у KeyCRM синхронізовано.`
        : `Увага: ${refundLabel.toLowerCase()} WayForPay повернено. Замовлення сайту: ${orderNum}. Сума: ${amountStr} грн. Transaction ID: ${txId}. Потрібна ручна перевірка фінансового запису.`;

      await this.client.request(
        "PUT",
        `/order/${order.keycrmOrderId}`,
        { manager_comment: commentText },
        "order",
        orderId
      );

      await OrderRepository.updateKeycrmSync(orderId, {
        keycrmSyncStatus: "synced",
        keycrmSyncError: null,
      });

      logger.info("Payment refund info synced to KeyCRM", {
        orderId,
        keycrmOrderId: order.keycrmOrderId,
        refundSynced,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await OrderRepository.updateKeycrmSync(orderId, {
        keycrmSyncStatus: "failed",
        keycrmSyncError: `Refund sync: ${message.substring(0, 400)}`,
        keycrmSyncRetries: { increment: 1 },
      });
      logger.error("Payment refund sync failed", { orderId, error: message.substring(0, 300) });
    }
  }

  /**
   * Sync payment reversal — delegates to syncPaymentRefund for full financial sync.
   */
  async syncPaymentReversal(orderId: string): Promise<void> {
    return this.syncPaymentRefund(orderId);
  }

  async retrySync(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const order = await OrderRepository.findById(orderId);
      if (!order) return { success: false, error: "Order not found" };

      // Refund/cancel → sync reversal
      const isRefundable = ["failed", "refunded", "cancelled", "prepayment_failed"].includes(order.paymentStatus);
      if (isRefundable && order.keycrmOrderId) {
        await this.syncPaymentReversal(orderId);
        return { success: true };
      }

      // Paid order → централізована синхронізація оплати
      if (["paid", "partial_paid"].includes(order.paymentStatus)) {
        await this.syncPaymentToKeyCRM(orderId);
        return { success: true };
      }

      // Інше (unpaid, pending) → створити замовлення
      await this.createOrder(orderId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async processPendingSyncs(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    if (process.env.CRM_SYNC_ENABLED === "false") {
      return { processed: 0, succeeded: 0, failed: 0 };
    }
    if (!process.env.KEYCRM_API_KEY) {
      logger.warn("KEYCRM_API_KEY not set, skipping sync");
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    const service = new KeyCRMService();
    const pendingOrders = await OrderRepository.findPendingSync(10);

    let succeeded = 0;
    let failed = 0;

    for (const order of pendingOrders) {
      const result = await service.retrySync(order.id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    logger.info("Pending syncs processed", {
      processed: pendingOrders.length,
      succeeded,
      failed,
    });

    return { processed: pendingOrders.length, succeeded, failed };
  }
}
