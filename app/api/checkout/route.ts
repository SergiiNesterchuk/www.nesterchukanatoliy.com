import { NextRequest } from "next/server";
import { OrderService } from "@/services/OrderService";
import { checkoutSchema } from "@/validators/checkout.schema";
import { successResponse, errorResponse } from "@/shared/api-response";
import { prisma } from "@/shared/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = checkoutSchema.parse(body);

    const order = await OrderService.createOrder({
      customerName: validated.customerName,
      customerPhone: validated.customerPhone,
      customerEmail: validated.customerEmail || undefined,
      deliveryMethod: validated.deliveryMethod,
      deliveryCity: validated.deliveryCity,
      deliveryAddress: validated.deliveryAddress,
      deliveryBranchRef: validated.deliveryBranchRef,
      deliveryBranchName: validated.deliveryBranchName,
      comment: validated.comment,
      paymentMethod: validated.paymentMethod,
      items: validated.items,
      utmSource: validated.utmSource,
      utmMedium: validated.utmMedium,
      utmCampaign: validated.utmCampaign,
      utmTerm: validated.utmTerm,
      utmContent: validated.utmContent,
      idempotencyKey: validated.idempotencyKey,
    });

    // Check if payment method requires online payment
    let requiresOnlinePayment = true;
    try {
      const pm = await prisma.paymentMethod.findUnique({
        where: { key: validated.paymentMethod },
        select: { requiresOnlinePayment: true },
      });
      if (pm) requiresOnlinePayment = pm.requiresOnlinePayment;
    } catch {
      // Fallback: card_online requires payment, anything else doesn't
      requiresOnlinePayment = validated.paymentMethod.includes("card") || validated.paymentMethod === "card_online";
    }

    if (requiresOnlinePayment) {
      // Online payment flow (WayForPay)
      const payment = await OrderService.createPaymentForOrder(order.id);
      return successResponse({
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentMethod: validated.paymentMethod,
        requiresOnlinePayment: true,
        payment: payment
          ? {
              url: payment.paymentUrl,
              sessionId: payment.sessionId,
              provider: payment.provider,
              formFields: (payment as unknown as Record<string, unknown>).formFields,
            }
          : null,
      });
    } else {
      // COD / no online payment flow — no WayForPay, sync to KeyCRM immediately
      try {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "cod_pending", status: "new" },
        });
        await prisma.orderStatusHistory.create({
          data: { orderId: order.id, source: "local", newStatus: "cod_pending", message: "Обрано оплату при отриманні" },
        });
      } catch { /* non-critical */ }

      if (process.env.CRM_SYNC_ENABLED !== "false") {
        await prisma.order.update({
          where: { id: order.id },
          data: { keycrmSyncStatus: "pending" },
        });
        import("@/services/KeyCRMService").then(({ KeyCRMService }) => {
          const service = new KeyCRMService();
          service.createOrder(order.id).catch(console.error);
        });
      }

      return successResponse({
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentMethod: validated.paymentMethod,
        requiresOnlinePayment: false,
        payment: null,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
