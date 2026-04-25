import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { z } from "zod";

const reviewSchema = z.object({
  productId: z.string().min(1),
  customerName: z.string().min(2, "Вкажіть ім'я").max(100),
  customerEmail: z.string().email().max(200).optional().or(z.literal("")),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().min(10, "Мінімум 10 символів").max(2000),
});

// GET: approved reviews with pagination + stats
export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");
  if (!productId) return NextResponse.json({ success: true, data: [], stats: null });

  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "5", 10);
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);

  const [reviews, total, stats] = await Promise.all([
    prisma.productReview.findMany({
      where: { productId, status: "approved" },
      orderBy: [{ displayDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: { id: true, customerName: true, rating: true, text: true, displayDate: true, createdAt: true },
      skip: offset,
      take: limit,
    }),
    prisma.productReview.count({ where: { productId, status: "approved" } }),
    prisma.productReview.aggregate({
      where: { productId, status: "approved" },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: reviews,
    stats: {
      averageRating: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : 0,
      totalCount: stats._count,
    },
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  });
}

// POST: submit new review (pending moderation)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = reviewSchema.parse(body);

    const review = await prisma.productReview.create({
      data: {
        productId: data.productId,
        customerName: data.customerName,
        customerEmail: data.customerEmail || null,
        rating: data.rating,
        text: data.text,
        status: "pending",
        source: "customer",
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: review.id },
      message: "Дякуємо! Відгук буде опубліковано після модерації.",
    });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((i) => i.message).join("; ")
      : "Помилка відправки відгуку";
    return NextResponse.json({ success: false, error: { message } }, { status: 400 });
  }
}
