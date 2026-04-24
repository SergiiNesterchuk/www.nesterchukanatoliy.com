import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { normalizePhoneUA } from "@/shared/phone";

export async function POST(request: NextRequest) {
  try {
    const { orderNumber, phone } = await request.json();

    if (!orderNumber || !phone) {
      return NextResponse.json({
        success: false,
        error: { message: "Вкажіть номер замовлення та телефон" },
      });
    }

    const normalizedPhone = normalizePhoneUA(phone);

    const order = await prisma.order.findFirst({
      where: {
        orderNumber: orderNumber.trim().toUpperCase(),
        customerPhone: normalizedPhone,
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

    // Return sanitized order (no internal IDs, CRM data, etc.)
    return NextResponse.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
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
        currency: order.currency,
        createdAt: order.createdAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        items: order.items.map((i) => ({
          name: i.name,
          sku: i.sku,
          price: i.price,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
        })),
        statusHistory: order.statusHistory.map((h) => ({
          status: h.newStatus,
          message: h.message,
          createdAt: h.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Order status lookup error:", error);
    return NextResponse.json({
      success: false,
      error: { message: "Помилка сервера" },
    });
  }
}
