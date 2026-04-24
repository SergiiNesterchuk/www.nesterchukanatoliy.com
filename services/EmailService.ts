import { Resend } from "resend";
import { createLogger } from "@/shared/logger";
import { formatPrice } from "@/shared/money";
import { IntegrationLogRepository } from "@/repositories/IntegrationLogRepository";

const logger = createLogger("EmailService");

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface OrderEmailData {
  publicOrderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  prepaymentAmount: number | null;
  paymentMethod: string;
  paymentStatus: string;
  deliveryCity: string | null;
  deliveryBranchName: string | null;
  items: Array<{ name: string; quantity: number; price: number; lineTotal: number }>;
}

export class EmailService {
  static async sendOrderConfirmation(order: OrderEmailData): Promise<boolean> {
    if (!order.customerEmail || !isValidEmail(order.customerEmail)) {
      logger.info("Email skipped: no valid email", { orderNumber: order.publicOrderNumber });
      return false;
    }

    const resend = getResendClient();
    if (!resend) {
      logger.info("Email skipped: RESEND_API_KEY not configured");
      return false;
    }

    const fromName = process.env.EMAIL_FROM_NAME || "Магазин Анатолія Нестерчука";
    const fromEmail = process.env.EMAIL_FROM || "orders@nesterchukanatoliy.com";
    const replyTo = process.env.EMAIL_REPLY_TO;
    const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://nesterchukanatoliy.com";

    // Build payment status text
    let paymentText = "";
    if (order.paymentStatus === "paid") {
      paymentText = "Оплачено онлайн карткою";
    } else if (order.paymentStatus === "partial_paid" && order.prepaymentAmount) {
      const prepay = order.prepaymentAmount / 100;
      const remaining = (order.total - order.prepaymentAmount) / 100;
      paymentText = `Передплата ${prepay} грн отримана. Решта до оплати при отриманні: ${remaining} грн`;
    } else {
      paymentText = "Очікує оплати";
    }

    const statusUrl = `${siteUrl.replace(/\/+$/, "")}/order-status`;
    const totalFormatted = formatPrice(order.total);

    const itemsHtml = order.items
      .map((i) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${i.name}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${formatPrice(i.lineTotal)}</td></tr>`)
      .join("");

    const html = `
<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#333">
  <div style="background:#16a34a;padding:20px;text-align:center;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:22px">Замовлення прийнято!</h1>
  </div>
  <div style="padding:24px;background:#fff;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px">
    <p>Шановний(а) <strong>${order.customerName}</strong>,</p>
    <p>Дякуємо за замовлення! Ваше замовлення <strong>№${order.publicOrderNumber}</strong> прийнято.</p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead><tr style="background:#f9f9f9"><th style="padding:8px;text-align:left">Товар</th><th style="padding:8px;text-align:center">К-ть</th><th style="padding:8px;text-align:right">Сума</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot><tr><td colspan="2" style="padding:8px;font-weight:bold">Разом:</td><td style="padding:8px;text-align:right;font-weight:bold">${totalFormatted}</td></tr></tfoot>
    </table>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin:16px 0">
      <p style="margin:0"><strong>Оплата:</strong> ${paymentText}</p>
      ${order.deliveryCity ? `<p style="margin:4px 0 0"><strong>Доставка:</strong> ${order.deliveryCity}${order.deliveryBranchName ? `, ${order.deliveryBranchName}` : ""}</p>` : ""}
    </div>

    <div style="text-align:center;margin:24px 0">
      <a href="${statusUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Перевірити статус замовлення</a>
    </div>

    <p style="font-size:13px;color:#888">Номер замовлення: ${order.publicOrderNumber}</p>
  </div>
</div>`;

    const text = `Замовлення №${order.publicOrderNumber} прийнято!\n\n${order.customerName}, дякуємо за замовлення.\nСума: ${totalFormatted}\nОплата: ${paymentText}\n\nПеревірити статус: ${statusUrl}`;

    try {
      const result = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: order.customerEmail,
        ...(replyTo ? { replyTo } : {}),
        subject: `Ваше замовлення №${order.publicOrderNumber} прийнято`,
        html,
        text,
      });

      logger.info("Order confirmation email sent", {
        orderNumber: order.publicOrderNumber,
        to: order.customerEmail,
        resendId: (result as { data?: { id?: string } }).data?.id,
      });

      await IntegrationLogRepository.create({
        integration: "resend",
        direction: "outbound",
        method: "POST",
        endpoint: "emails.send",
        entityType: "order",
        entityId: order.publicOrderNumber,
        responseStatus: 200,
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Email send failed", { orderNumber: order.publicOrderNumber, error: message });

      await IntegrationLogRepository.create({
        integration: "resend",
        direction: "outbound",
        method: "POST",
        endpoint: "emails.send",
        entityType: "order",
        entityId: order.publicOrderNumber,
        errorMessage: message.substring(0, 500),
        responseStatus: 500,
      });

      return false;
    }
  }

  static async sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
    const resend = getResendClient();
    if (!resend) return { success: false, error: "RESEND_API_KEY not configured" };

    const fromName = process.env.EMAIL_FROM_NAME || "Магазин";
    const fromEmail = process.env.EMAIL_FROM || "orders@nesterchukanatoliy.com";

    try {
      await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject: "Тестовий лист від магазину",
        html: "<p>Це тестовий лист. Якщо ви його бачите — email працює коректно.</p>",
        text: "Це тестовий лист. Email працює коректно.",
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
