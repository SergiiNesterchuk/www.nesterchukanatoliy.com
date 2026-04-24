import { prisma } from "@/shared/db";

export class OrderRepository {
  static async create(data: {
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryMethod: string;
    deliveryCity?: string;
    deliveryAddress?: string;
    deliveryBranchRef?: string;
    deliveryBranchName?: string;
    comment?: string;
    paymentMethod: string;
    subtotal: number;
    discountTotal?: number;
    deliveryCost?: number;
    total: number;
    idempotencyKey: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    items: Array<{
      productId: string;
      name: string;
      sku: string;
      price: number;
      quantity: number;
      lineTotal: number;
      imageUrl?: string;
    }>;
  }) {
    const { items, ...orderData } = data;
    return prisma.order.create({
      data: {
        ...orderData,
        items: { create: items },
      },
      include: { items: true },
    });
  }

  static async findByIdempotencyKey(key: string) {
    return prisma.order.findUnique({
      where: { idempotencyKey: key },
      include: { items: true },
    });
  }

  static async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: { items: true, payments: true },
    });
  }

  static async findByOrderNumber(orderNumber: string) {
    return prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
  }

  static async updatePaymentStatus(
    id: string,
    data: {
      paymentStatus: string;
      paymentProvider?: string;
      externalPaymentId?: string;
      status?: string;
    }
  ) {
    return prisma.order.update({
      where: { id },
      data,
    });
  }

  static async updateKeycrmSync(
    id: string,
    data: {
      keycrmOrderId?: string;
      keycrmBuyerId?: string;
      keycrmPaymentId?: string;
      keycrmSyncStatus: string;
      keycrmSyncError?: string | null;
      keycrmSyncRetries?: { increment: number };
    }
  ) {
    return prisma.order.update({
      where: { id },
      data,
    });
  }

  static async findPendingSync(limit = 10) {
    return prisma.order.findMany({
      where: {
        keycrmSyncStatus: { in: ["pending", "failed"] },
        keycrmSyncRetries: { lt: 5 },
        paymentStatus: { in: ["paid", "failed"] },
      },
      include: { items: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  static async findMany(options: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = options;
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return { items, total, page, pages: Math.ceil(total / limit) };
  }
}
