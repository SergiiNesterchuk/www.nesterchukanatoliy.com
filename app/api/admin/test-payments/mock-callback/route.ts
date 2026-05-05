import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/shared/admin-auth";
import { OrderRepository } from "@/repositories/OrderRepository";
import { isStaging } from "@/shared/features";
import { prisma } from "@/shared/db";
import { createLogger } from "@/shared/logger";

const logger = createLogger("MockPayment");

/**
 * Staging-only endpoint to simulate payment callbacks.
 * POST /api/admin/test-payments/mock-callback
 * Body: { orderId: string, action: "success" | "failure" | "refund" }
 *
 * Production always returns 403.
 */
export const POST = adminGuard(async (req: NextRequest) => {
  if (!isStaging) {
    return NextResponse.json({ success: false, error: "Only available on staging" }, { status: 403 });
  }

  const { orderId, action } = await req.json();
  if (!orderId || !["success", "failure", "refund"].includes(action)) {
    return NextResponse.json({ success: false, error: "orderId and action (success|failure|refund) required" }, { status: 400 });
  }

  const order = await OrderRepository.findById(orderId);
  if (!order) {
    return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
  }

  const mockTxId = `MOCK-${action.toUpperCase()}-${Date.now()}`;
  const isCodPrepayment = order.paymentPurpose === "cod_prepayment" || order.paymentMethod.includes("cod");

  if (action === "success") {
    const amount = isCodPrepayment && order.prepaymentAmount ? order.prepaymentAmount : order.total;
    const newStatus = isCodPrepayment ? "partial_paid" : "paid";

    await prisma.paymentEvent.create({
      data: { orderId, provider: "mock", eventType: "success", externalId: mockTxId, amount, currency: "UAH", rawPayload: `{"mock":"${action}"}`, signatureValid: true },
    });
    await OrderRepository.updatePaymentStatus(orderId, {
      paymentStatus: newStatus, paymentProvider: "mock", externalPaymentId: mockTxId,
      status: isCodPrepayment ? "new" : "paid",
    });
    await prisma.orderStatusHistory.create({
      data: { orderId, source: "payment", oldStatus: order.paymentStatus, newStatus, message: `[MOCK] ${isCodPrepayment ? "Передплату отримано" : "Оплату отримано"}` },
    }).catch(() => {});

    logger.info("Mock success applied", { orderId, orderNumber: order.orderNumber, newStatus });
    return NextResponse.json({ success: true, data: { orderId, action, newStatus } });
  }

  if (action === "failure") {
    const failStatus = isCodPrepayment ? "prepayment_failed" : "failed";

    await prisma.paymentEvent.create({
      data: { orderId, provider: "mock", eventType: "failure", externalId: mockTxId, amount: 0, currency: "UAH", rawPayload: `{"mock":"${action}"}`, signatureValid: true },
    });
    await OrderRepository.updatePaymentStatus(orderId, { paymentStatus: failStatus });
    await prisma.orderStatusHistory.create({
      data: { orderId, source: "payment", oldStatus: order.paymentStatus, newStatus: failStatus, message: `[MOCK] ${isCodPrepayment ? "Передплата не пройшла" : "Оплата не пройшла"}` },
    }).catch(() => {});

    logger.info("Mock failure applied", { orderId, orderNumber: order.orderNumber, failStatus });
    return NextResponse.json({ success: true, data: { orderId, action, newStatus: failStatus } });
  }

  if (action === "refund") {
    await prisma.paymentEvent.create({
      data: { orderId, provider: "mock", eventType: "refund", externalId: mockTxId, amount: order.total, currency: "UAH", rawPayload: `{"mock":"${action}"}`, signatureValid: true },
    });
    await OrderRepository.updatePaymentStatus(orderId, { paymentStatus: "refunded" });
    await prisma.orderStatusHistory.create({
      data: { orderId, source: "payment", oldStatus: order.paymentStatus, newStatus: "refunded", message: "[MOCK] Кошти повернено" },
    }).catch(() => {});

    logger.info("Mock refund applied", { orderId, orderNumber: order.orderNumber });
    return NextResponse.json({ success: true, data: { orderId, action, newStatus: "refunded" } });
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
});
