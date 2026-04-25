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
  statusHistory: Array<{ source: string; newStatus: string; message: string | null; createdAt: Date }>;
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
      status: h.newStatus, source: h.source, message: h.message, createdAt: h.createdAt,
    })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderNumber, phone, customerName, mode, token } = body;

    // Mode 0: token-based access (from email link)
    if (token) {
      const { hashAccessToken } = await import("@/shared/access-token");
      const tokenHash = hashAccessToken(token);

      const order = await prisma.order.findFirst({
        where: {
          accessTokenHash: tokenHash,
          accessTokenExpiresAt: { gte: new Date() },
        },
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: "desc" }, take: 10 },
        },
      });

      if (!order) {
        return NextResponse.json({
          success: false,
          error: { message: "Посилання недійсне або застаріло. Використайте форму нижче." },
          tokenExpired: true,
        });
      }

      return NextResponse.json({ success: true, data: sanitizeOrder(order) });
    }

    // Mode 1: orderNumber + phone (default)
    if (mode !== "phone_name") {
      if (!orderNumber || !phone) {
        return NextResponse.json({
          success: false,
          error: { message: "Вкажіть номер замовлення та телефон" },
        });
      }

      const normalizedPhone = normalizePhoneUA(phone);
      const raw = orderNumber.trim().toUpperCase().replace(/\s/g, "");

      // Minimum 3 chars for search
      if (raw.length < 3) {
        return NextResponse.json({
          success: false,
          error: { message: "Номер замовлення має бути не менше 3 символів" },
        });
      }

      // Normalize: "5001" → search for both "5001" and "K-5001"
      const searchVariants = [raw];
      if (/^\d+$/.test(raw)) searchVariants.push(`K-${raw}`);
      if (raw.startsWith("K") && !raw.startsWith("K-")) searchVariants.push(`K-${raw.substring(1)}`);

      // Try exact match first
      let order = await prisma.order.findFirst({
        where: {
          customerPhone: normalizedPhone,
          OR: searchVariants.flatMap((v) => [
            { orderNumber: v },
            { publicOrderNumber: v },
          ]),
        },
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: "desc" }, take: 10 },
        },
      });

      // Fallback: partial match (LIKE search) if exact not found
      if (!order) {
        const partialOrders = await prisma.order.findMany({
          where: {
            customerPhone: normalizedPhone,
            OR: [
              { orderNumber: { contains: raw, mode: "insensitive" } },
              { publicOrderNumber: { contains: raw, mode: "insensitive" } },
            ],
          },
          include: {
            items: true,
            statusHistory: { orderBy: { createdAt: "desc" }, take: 5 },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        });

        if (partialOrders.length === 1) {
          order = partialOrders[0];
        } else if (partialOrders.length > 1) {
          return NextResponse.json({
            success: true,
            data: null,
            list: partialOrders.map((o) => ({
              orderNumber: o.publicOrderNumber || o.orderNumber,
              status: o.status,
              paymentStatus: o.paymentStatus,
              total: o.total,
              createdAt: o.createdAt,
            })),
          });
        }
      }

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
