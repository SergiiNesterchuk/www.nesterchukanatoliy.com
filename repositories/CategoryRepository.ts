import { prisma } from "@/shared/db";

export class CategoryRepository {
  static async findAll() {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
    });
  }

  static async findBySlug(slug: string) {
    return prisma.category.findFirst({
      where: { slug, isActive: true },
    });
  }

  static async findAllSlugs() {
    return prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true },
    });
  }
}
