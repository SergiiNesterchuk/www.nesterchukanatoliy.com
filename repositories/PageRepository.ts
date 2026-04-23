import { prisma } from "@/shared/db";

export class PageRepository {
  static async findBySlug(slug: string) {
    return prisma.page.findFirst({
      where: { slug, isActive: true },
    });
  }

  static async findAll() {
    return prisma.page.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, slug: true },
    });
  }
}
