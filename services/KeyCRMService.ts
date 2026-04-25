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

      // Debug: логувати payment payload що відправляється
      const orderNum = order.publicOrderNumber || order.orderNumber;
      logger.info("createOrder: payload payments", {
        orderId, orderNumber: orderNum,
        localPaymentStatus: order.paymentStatus,
        localPaymentMethod: order.paymentMethod,
        paymentsInPayload: keycrmPayload.payments?.length || 0,
        paymentDetails: keycrmPayload.payments?.map((p) => ({
          payment_method_id: p.payment_method_id,
          payment_method: p.payment_method,
          amount: p.amount,
          status: p.status,
        })),
      });

      const keycrmOrder = await this.client.request<KeyCRMOrderResponse>(
        "POST",
        "/order",
        keycrmPayload,
        "order",
        orderId
      );

      // Перевірити чи payments створились і отримати keycrmPaymentId
      let keycrmPaymentId: string | undefined;
      try {
        const fullOrder = await this.client.request<{ payments?: Array<{ id: number; status: string; payment_method_id?: number; payment_method?: string }> }>(
          "GET",
          `/order/${keycrmOrder.id}?include=payments`,
          undefined, "order", orderId
        );
        const payments = fullOrder.payments || [];

        logger.info("createOrder: KeyCRM payments after create", {
          orderId, orderNumber: orderNum,
          keycrmOrderId: keycrmOrder.id,
          paymentsCount: payments.length,
          payments: payments.map((p) => ({
            id: p.id, status: p.status,
            payment_method_id: p.payment_method_id,
            payment_method: p.payment_method,
          })),
        });

        if (payments.length > 0) {
          keycrmPaymentId = String(payments[0].id);
        }

        // Якщо payments не створились — прикріпити вручну
        if (payments.length === 0) {
          const methodId = KeyCRMMapper.getPaymentMethodId(order.paymentMethod, order.paymentPurpose);
          const isCodPrepay = order.paymentPurpose === "cod_prepayment";
          const amountUAH = isCodPrepay && order.prepaymentAmount
            ? Number(order.prepaymentAmount) / 100
            : Number(order.total) / 100;
          const isPaid = order.paymentStatus === "paid" || order.paymentStatus === "partial_paid";
          const attachPayload = {
            payment_method_id: methodId,
            amount: amountUAH,
            status: isPaid ? "paid" : "not_paid",
            description: isPaid && order.externalPaymentId
              ? `WayForPay: ${order.externalPaymentId}. Замовлення сайту: ${orderNum}`
              : `WayForPay інвойс. Замовлення сайту: ${orderNum}`,
          };

          logger.info("createOrder: attaching payment manually (POST /order ignored payments)", {
            orderId, orderNumber: orderNum, payload: attachPayload,
          });

          const attachResult = await this.client.request<{ id?: number }>(
            "POST",
            `/order/${keycrmOrder.id}/payment`,
            attachPayload, "order", orderId
          );
          if (attachResult?.id) {
            keycrmPaymentId = String(attachResult.id);
          }

          // Верифікація
          const verify = await this.client.request<{ payments?: Array<{ id: number; payment_method_id?: number; payment_method?: string }> }>(
            "GET",
            `/order/${keycrmOrder.id}?include=payments`,
            undefined, "order", orderId
          ).catch(() => null);

          if (verify?.payments) {
            logger.info("createOrder: verification after manual attach", {
              orderId, paymentsCount: verify.payments.length,
              payments: verify.payments.map((p) => ({
                id: p.id, payment_method_id: p.payment_method_id, payment_method: p.payment_method,
              })),
            });
          }
        }
      } catch (e) {
        logger.warn("createOrder: could not fetch/attach payments", {
          orderId, error: e instanceof Error ? e.message : String(e),
        });
      }

      await OrderRepository.updateKeycrmSync(orderId, {
        keycrmOrderId: String(keycrmOrder.id),
        keycrmBuyerId: String(keycrmOrder.buyer_id),
        keycrmPaymentId,
        keycrmSyncStatus: "synced",
        keycrmSyncError: null,
      });

      logger.info("Order synced to KeyCRM", {
        orderId, orderNumber: orderNum,
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

    // Визначити правильний payment_method_id і суму
    const isCodPrepayment = order.paymentPurpose === "cod_prepayment";
    const paymentMethodId = KeyCRMMapper.getPaymentMethodId(order.paymentMethod, order.paymentPurpose);
    const amountUAH = isCodPrepayment && order.prepaymentAmount
      ? order.prepaymentAmount / 100
      : order.total / 100;
    const txDescription = order.externalPaymentId
      ? `WayForPay: ${order.externalPaymentId}. Замовлення сайту: ${orderNum}`
      : isCodPrepayment
        ? `WayForPay передплата. Замовлення сайту: ${orderNum}`
        : `Оплата карткою. Замовлення сайту: ${orderNum}`;

    logger.info("syncPaymentToKeyCRM: payment details", {
      orderId, orderNumber: orderNum, paymentMethodId, amountUAH,
      isCodPrepayment, paymentPurpose: order.paymentPurpose,
      action: "resolving",
    });

    try {
      const keycrmOrder = await this.client.request<{ payments?: Array<{ id: number; status: string; amount: number }> }>(
        "GET",
        `/order/${order.keycrmOrderId}?include=payments`,
        undefined, "order", orderId
      );

      const payments = keycrmOrder.payments || [];

      // Шукаємо існуючу оплату: спочатку по keycrmPaymentId, потім будь-яку not_paid
      let targetPayment = order.keycrmPaymentId
        ? payments.find((p) => String(p.id) === order.keycrmPaymentId)
        : undefined;

      if (!targetPayment) {
        // Шукаємо будь-яку not_paid оплату з відповідною сумою
        targetPayment = payments.find((p) => p.status === "not_paid");
      }

      // Case D: вже є paid оплата → пропуск
      const paidPayment = payments.find((p) => p.status === "paid");
      if (paidPayment) {
        // Зберегти keycrmPaymentId якщо ще не збережений
        if (!order.keycrmPaymentId) {
          const { prisma } = await import("@/shared/db");
          await prisma.order.update({
            where: { id: orderId },
            data: { keycrmPaymentId: String(paidPayment.id) },
          });
        }
        logger.info("syncPaymentToKeyCRM: оплата вже paid в KeyCRM, пропуск", {
          orderId, orderNumber: orderNum, keycrmPaymentId: paidPayment.id, action: "skip",
        });
        return;
      }

      // Case C: є not_paid оплата → оновити на paid
      if (targetPayment) {
        const updatePayload = {
          status: "paid",
          payment_method_id: paymentMethodId,
          description: txDescription,
        };

        logger.info("syncPaymentToKeyCRM: оновлюємо not_paid → paid", {
          orderId, orderNumber: orderNum, keycrmPaymentId: targetPayment.id,
          oldStatus: targetPayment.status, paymentMethodId, action: "updatePayment",
          payload: updatePayload,
        });

        await this.client.request(
          "PUT",
          `/order/${order.keycrmOrderId}/payment/${targetPayment.id}`,
          updatePayload,
          "order", orderId
        );

        // Зберегти keycrmPaymentId
        if (!order.keycrmPaymentId || order.keycrmPaymentId !== String(targetPayment.id)) {
          const { prisma } = await import("@/shared/db");
          await prisma.order.update({
            where: { id: orderId },
            data: { keycrmPaymentId: String(targetPayment.id) },
          });
        }

        // Верифікація
        this.verifyPaymentInKeyCRM(order.keycrmOrderId, orderId, orderNum);
        return;
      }
    } catch (e) {
      logger.warn("syncPaymentToKeyCRM: не вдалося перевірити оплати, спробуємо прикріпити нову", {
        orderId, error: e instanceof Error ? e.message : String(e),
      });
    }

    // Case B: замовлення в KeyCRM, оплати не знайдено → прикріпити нову
    const attachPayload = {
      payment_method_id: paymentMethodId,
      amount: amountUAH,
      status: "paid",
      description: txDescription,
    };

    logger.info("syncPaymentToKeyCRM: прикріплюємо нову оплату", {
      orderId, orderNumber: orderNum, keycrmOrderId: order.keycrmOrderId,
      action: "attachPayment", payload: attachPayload,
    });

    try {
      const result = await this.client.request<{ id?: number }>(
        "POST",
        `/order/${order.keycrmOrderId}/payment`,
        attachPayload,
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

      // Верифікація
      this.verifyPaymentInKeyCRM(order.keycrmOrderId, orderId, orderNum);
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

  /** Верифікація: перевірити що оплата з'явилась в KeyCRM після attach/update */
  private verifyPaymentInKeyCRM(keycrmOrderId: string, orderId: string, orderNum: string): void {
    // Не блокуюча верифікація
    this.client.request<{ payments?: Array<{ id: number; status: string; payment_method_id?: number; payment_method?: string }> }>(
      "GET",
      `/order/${keycrmOrderId}?include=payments`,
      undefined, "order", orderId
    ).then((verify) => {
      const paidPayments = verify.payments?.filter((p) => p.status === "paid") || [];
      const lastPaid = paidPayments[paidPayments.length - 1];
      logger.info("syncPaymentToKeyCRM: верифікація", {
        orderId, orderNumber: orderNum,
        paymentsTotal: verify.payments?.length || 0,
        paidCount: paidPayments.length,
        lastPaidMethodId: lastPaid?.payment_method_id,
        lastPaidMethod: lastPaid?.payment_method,
      });
      if (paidPayments.length === 0) {
        logger.error("syncPaymentToKeyCRM: ВЕРИФІКАЦІЯ НЕВДАЛА — paid оплата не знайдена", {
          orderId, keycrmOrderId,
        });
      }
    }).catch(() => { /* верифікація не критична */ });
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
