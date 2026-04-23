import { prisma } from "@/shared/db";

export class IntegrationLogRepository {
  static async create(data: {
    integration: string;
    direction: string;
    method: string;
    endpoint: string;
    entityType?: string;
    entityId?: string;
    payloadHash?: string;
    requestBody?: string;
    responseBody?: string;
    responseStatus?: number;
    errorMessage?: string;
    retryCount?: number;
    durationMs?: number;
  }) {
    return prisma.integrationLog.create({ data });
  }

  static async findRecent(options: {
    integration?: string;
    limit?: number;
    page?: number;
  }) {
    const { integration, limit = 50, page = 1 } = options;
    const skip = (page - 1) * limit;
    const where = integration ? { integration } : {};

    const [items, total] = await Promise.all([
      prisma.integrationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.integrationLog.count({ where }),
    ]);

    return { items, total, page, pages: Math.ceil(total / limit) };
  }
}
