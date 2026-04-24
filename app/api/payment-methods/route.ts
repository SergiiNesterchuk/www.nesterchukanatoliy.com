import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";

export async function GET() {
  try {
    const methods = await prisma.paymentMethod.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: "asc" },
      select: {
        key: true,
        title: true,
        description: true,
        requiresOnlinePayment: true,
      },
    });
    return NextResponse.json({ success: true, data: methods });
  } catch {
    // Fallback if table doesn't exist yet
    return NextResponse.json({
      success: true,
      data: [{ key: "card_online", title: "Оплата карткою онлайн", description: null, requiresOnlinePayment: true }],
    });
  }
}
