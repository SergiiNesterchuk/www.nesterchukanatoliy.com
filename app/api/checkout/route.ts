import { NextRequest } from "next/server";
import { OrderService } from "@/services/OrderService";
import { checkoutSchema } from "@/validators/checkout.schema";
import { successResponse, errorResponse } from "@/shared/api-response";

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

    // Create payment session
    const payment = await OrderService.createPaymentForOrder(order.id);

    return successResponse({
      orderId: order.id,
      orderNumber: order.orderNumber,
      payment: {
        url: payment.paymentUrl,
        sessionId: payment.sessionId,
        provider: payment.provider,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
