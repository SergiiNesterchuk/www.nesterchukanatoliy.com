import { EmailService } from "./EmailService";
import { createLogger } from "@/shared/logger";
import { prisma } from "@/shared/db";

const logger = createLogger("NotificationService");

interface OrderForNotification {
  id: string;
  orderNumber: string;
  publicOrderNumber: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  total: number;
  prepaymentAmount: number | null;
  paymentMethod: string;
  paymentStatus: string;
  deliveryCity: string | null;
  deliveryBranchName: string | null;
  emailSentAt: Date | null;
  smsSentAt: Date | null;
  items: Array<{ name: string; quantity: number; price: number; lineTotal: number }>;
}

export class NotificationService {
  /**
   * Send order confirmation notifications (email + future SMS/Viber).
   * Call after payment confirmed (paid or partial_paid).
   * Idempotent: checks emailSentAt before sending.
   */
  static async sendOrderConfirmation(order: OrderForNotification): Promise<void> {
    // Email
    if (order.customerEmail && !order.emailSentAt) {
      try {
        const sent = await EmailService.sendOrderConfirmation({
          publicOrderNumber: order.publicOrderNumber || order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          total: order.total,
          prepaymentAmount: order.prepaymentAmount,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          deliveryCity: order.deliveryCity,
          deliveryBranchName: order.deliveryBranchName,
          items: order.items,
        });

        if (sent) {
          await prisma.order.update({
            where: { id: order.id },
            data: { emailSentAt: new Date() },
          });
          logger.info("Order confirmation email sent", { orderId: order.id });
        }
      } catch (error) {
        // Non-blocking: log but don't fail order
        logger.error("Email notification failed", {
          orderId: order.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // SMS/Viber — future integration (no-op for now)
    if (order.customerPhone && !order.smsSentAt) {
      await this.sendOrderSmsOrViber(order);
    }
  }

  /**
   * Future SMS/Viber integration.
   * Currently a no-op placeholder — logs intent without sending.
   */
  static async sendOrderSmsOrViber(order: OrderForNotification): Promise<void> {
    // No SMS/Viber provider configured yet
    // When provider is chosen, implement here
    logger.debug("SMS/Viber notification skipped: no provider configured", {
      orderId: order.id,
      phone: order.customerPhone.substring(0, 6) + "****",
    });
  }
}
