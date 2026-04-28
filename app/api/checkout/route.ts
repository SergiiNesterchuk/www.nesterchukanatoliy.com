import { NextRequest } from "next/server";
import { OrderService } from "@/services/OrderService";
import { checkoutSchema } from "@/validators/checkout.schema";
import { successResponse, errorResponse } from "@/shared/api-response";
import { prisma } from "@/shared/db";
import { COD_PREPAYMENT_AMOUNT } from "@/shared/constants";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = checkoutSchema.parse(body);

    const isCod = validated.paymentMethod.includes("cod");
    const isBankTransfer = validated.paymentMethod === "bank_transfer";

    // Pre-validate COD: calculate total from product prices before creating order
    if (isCod) {
      const productIds = validated.items.map((i: { productId: string }) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, price: true },
      });
      const priceMap = new Map(products.map((p) => [p.id, p.price]));
      const estimatedTotal = validated.items.reduce((sum: number, item: { productId: string; quantity: number }) => {
        return sum + (priceMap.get(item.productId) || 0) * item.quantity;
      }, 0);

      if (estimatedTotal <= COD_PREPAYMENT_AMOUNT) {
        console.log("[Checkout] COD prepayment rejected: totalAmount=%d, paymentMethod=%s, reason=total <= prepayment threshold", estimatedTotal, validated.paymentMethod);
        return errorResponse(new Error("Накладений платіж з передплатою доступний для замовлень понад 200 грн."));
      }
    }

    // For COD: set prepayment fields before order creation
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

    if (isCod) {
      // COD with prepayment 200 UAH
      const prepaymentAmount = Math.min(COD_PREPAYMENT_AMOUNT, order.total);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "awaiting_prepayment",
          paymentPurpose: "cod_prepayment",
          prepaymentAmount,
        },
      });

      await prisma.orderStatusHistory.create({
        data: { orderId: order.id, source: "local", newStatus: "awaiting_prepayment", message: `Очікує передплати ${prepaymentAmount / 100} грн` },
      }).catch(() => {});

      // Create WayForPay session for prepayment amount only
      const payment = await OrderService.createPaymentForOrder(order.id, prepaymentAmount);

      // Синхронізувати з KeyCRM одразу (з unpaid prepayment + remainder)
      if (process.env.CRM_SYNC_ENABLED !== "false") {
        import("@/services/KeyCRMService").then(({ KeyCRMService }) => {
          const service = new KeyCRMService();
          service.createOrder(order.id).catch(async (e) => {
            const { createLogger } = await import("@/shared/logger");
            createLogger("Checkout").error("COD CRM sync failed at checkout", {
              orderId: order.id, orderNumber: order.orderNumber,
              error: e instanceof Error ? e.message : String(e),
            });
            // Позначити для retry — не ковтати мовчки
            await prisma.order.update({
              where: { id: order.id },
              data: { keycrmSyncStatus: "failed", keycrmSyncError: `Checkout sync: ${String(e).substring(0, 400)}` },
            }).catch(() => {});
          });
        });
      }

      return successResponse({
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentMethod: validated.paymentMethod,
        requiresOnlinePayment: true,
        prepaymentAmount,
        remainingAmount: order.total - prepaymentAmount,
        payment: payment
          ? {
              url: payment.paymentUrl,
              sessionId: payment.sessionId,
              provider: payment.provider,
              formFields: (payment as unknown as Record<string, unknown>).formFields,
            }
          : null,
      });
    } else if (isBankTransfer) {
      // Оплата на рахунок — без WayForPay, менеджер надішле реквізити
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentPurpose: "bank_transfer", paymentStatus: "pending" },
      }).catch(() => {});

      // Синхронізувати з KeyCRM одразу (з not_paid payment)
      if (process.env.CRM_SYNC_ENABLED !== "false") {
        import("@/services/KeyCRMService").then(({ KeyCRMService }) => {
          const service = new KeyCRMService();
          service.createOrder(order.id).catch(async (e) => {
            await prisma.order.update({
              where: { id: order.id },
              data: { keycrmSyncStatus: "failed", keycrmSyncError: `Checkout sync: ${String(e).substring(0, 400)}` },
            }).catch(() => {});
          });
        });
      }

      return successResponse({
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentMethod: validated.paymentMethod,
        requiresOnlinePayment: false,
      });
    } else {
      // Full card payment (card_wayforpay)
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentPurpose: "full_payment" },
      }).catch(() => {});

      const payment = await OrderService.createPaymentForOrder(order.id);

      // Синхронізувати замовлення в KeyCRM одразу (з unpaid payment)
      if (process.env.CRM_SYNC_ENABLED !== "false") {
        import("@/services/KeyCRMService").then(({ KeyCRMService }) => {
          const service = new KeyCRMService();
          service.createOrder(order.id).catch(async (e) => {
            await prisma.order.update({
              where: { id: order.id },
              data: { keycrmSyncStatus: "failed", keycrmSyncError: `Checkout sync: ${String(e).substring(0, 400)}` },
            }).catch(() => {});
          });
        });
      }

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
    }
  } catch (error) {
    return errorResponse(error);
  }
}
