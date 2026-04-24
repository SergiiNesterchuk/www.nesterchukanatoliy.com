import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { normalizePhoneUA } from "@/shared/phone";

function sanitizeOrder(order: {
  orderNumber: string; publicOrderNumber: string | null; status: string;
  paymentStatus: string; deliveryStatus: string | null; trackingNumber: string | null;
  customerName: string; deliveryCity: string | null; deliveryBranchName: string | null;
  deliveryAddress: string | null; deliveryMethod: string; total: number;
  prepaymentAmount: number | null; currency: string;
  createdAt: Date; shippedAt: Date | null; deliveredAt: Date | null;
  items: Array<{ name: string; sku: string; price: number; quantity: number; lineTotal: number }>;
  statusHistory: Array<{ newStatus: string; message: string | null; createdAt: Date }>;
}) {
  return {
    orderNumber: order.publicOrderNumber || order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    trackingNumber: order.trackingNumber,
    customerName: order.customerName,
    deliveryCity: order.deliveryCity,
    deliveryBranchName: order.deliveryBranchName,
    deliveryAddress: order.deliveryAddress,
    deliveryMethod: order.deliveryMethod,
    total: order.total,
    prepaymentAmount: order.prepaymentAmount,
    currency: order.currency,
    createdAt: order.createdAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    items: order.items.map((i) => ({
      name: i.name, sku: i.sku, price: i.price, quantity: i.quantity, lineTotal: i.lineTotal,
    })),
    statusHistory: order.statusHistory.map((h) => ({
      status: h.newStatus, message: h.message, createdAt: h.createdAt,
    })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderNumber, phone, customerName, mode } = body;

    // Mode 1: orderNumber + phone (default)
    if (mode !== "phone_name") {
      if (!orderNumber || !phone) {
        return NextResponse.json({
          success: false,
          error: { message: "Вкажіть номер замовлення та телефон" },
        });
      }

      const normalizedPhone = normalizePhoneUA(phone);
      const searchNumber = orderNumber.trim().toUpperCase();

      // Search by both orderNumber and publicOrderNumber
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { orderNumber: searchNumber, customerPhone: normalizedPhone },
            { publicOrderNumber: searchNumber, customerPhone: normalizedPhone },
          ],
        },
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: "desc" }, take: 10 },
        },
      });

      if (!order) {
        return NextResponse.json({
          success: false,
          error: { message: "Замовлення не знайдено. Перевірте номер та телефон." },
        });
      }

      return NextResponse.json({ success: true, data: sanitizeOrder(order) });
    }

    // Mode 2: phone + customerName (no order number)
    if (!phone || !customerName) {
      return NextResponse.json({
        success: false,
        error: { message: "Вкажіть телефон та ім'я" },
      });
    }

    if (customerName.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: { message: "Ім'я має бути не менше 2 символів" },
      });
    }

    const normalizedPhone = normalizePhoneUA(phone);

    const orders = await prisma.order.findMany({
      where: {
        customerPhone: normalizedPhone,
        customerName: { contains: customerName.trim(), mode: "insensitive" },
      },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: { message: "Замовлення не знайдено. Перевірте телефон та ім'я." },
      });
    }

    return NextResponse.json({
      success: true,
      data: orders.length === 1 ? sanitizeOrder(orders[0]) : null,
      list: orders.map((o) => ({
        orderNumber: o.publicOrderNumber || o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        total: o.total,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    console.error("Order status lookup error:", error);
    return NextResponse.json({
      success: false,
      error: { message: "Помилка сервера" },
    });
  }
}
