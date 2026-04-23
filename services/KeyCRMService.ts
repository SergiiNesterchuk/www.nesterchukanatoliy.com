import { KeyCRMClient } from "@/integrations/keycrm/KeyCRMClient";
import { KeyCRMMapper } from "@/integrations/keycrm/KeyCRMMapper";
import type { KeyCRMOrderResponse, KeyCRMBuyerResponse } from "@/integrations/keycrm/types";
import { OrderRepository } from "@/repositories/OrderRepository";
import { RetryableSyncError, FatalSyncError } from "@/shared/errors";
import { createLogger } from "@/shared/logger";

const logger = createLogger("KeyCRMService");

export class KeyCRMService {
  private client: KeyCRMClient;
  private sourceId: number;

  constructor() {
    this.client = new KeyCRMClient();
    this.sourceId = parseInt(process.env.KEYCRM_SOURCE_ID || "1", 10);
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

      await OrderRepository.updateKeycrmSync(orderId, {
        keycrmOrderId: String(keycrmOrder.id),
        keycrmBuyerId: String(keycrmOrder.buyer_id),
        keycrmSyncStatus: "synced",
        keycrmSyncError: null,
      });

      logger.info("Order synced to KeyCRM", {
        orderId,
        keycrmOrderId: keycrmOrder.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await OrderRepository.updateKeycrmSync(orderId, {
        keycrmSyncStatus: "failed",
        keycrmSyncError: message.substring(0, 500),
        keycrmSyncRetries: { increment: 1 },
      });

      throw new RetryableSyncError(`Failed to sync order ${orderId}: ${message}`);
    }
  }

  async attachPayment(orderId: string): Promise<void> {
    const order = await OrderRepository.findById(orderId);
    if (!order || !order.keycrmOrderId) return;

    try {
      await this.client.request(
        "POST",
        `/order/${order.keycrmOrderId}/payment`,
        {
          payment_method: KeyCRMMapper.mapPaymentMethod(order.paymentMethod),
          amount: order.total / 100,
          status: "paid",
          description: order.externalPaymentId
            ? `WayForPay: ${order.externalPaymentId}`
            : "Оплата карткою",
        },
        "order",
        orderId
      );

      logger.info("Payment attached in KeyCRM", {
        orderId,
        keycrmOrderId: order.keycrmOrderId,
      });
    } catch (error) {
      logger.warn("Failed to attach payment in KeyCRM", {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async retrySync(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
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
