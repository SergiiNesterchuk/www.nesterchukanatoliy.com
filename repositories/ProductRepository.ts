import { prisma } from "@/shared/db";
import type { SortOption } from "@/shared/constants";

const productWithImages = {
  images: { orderBy: { sortOrder: "asc" as const } },
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { reviews: { where: { status: "approved" as const } } } },
};

export class ProductRepository {
  static async findBySlug(slug: string) {
    return prisma.product.findFirst({
      where: { slug, isActive: true },
      include: productWithImages,
    });
  }

  static async findMany(options: {
    categorySlug?: string;
    sort?: SortOption;
    page?: number;
    limit?: number;
  }) {
    const { categorySlug, sort = "popularity", page = 1, limit = 12 } = options;
    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    };

    const orderBy = this.buildOrderBy(sort);

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: productWithImages,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  static async findByIds(ids: string[]) {
    return prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    });
  }

  static async findAll() {
    return prisma.product.findMany({
      where: { isActive: true },
      include: productWithImages,
      orderBy: { sortOrder: "asc" },
    });
  }

  static async findAllSlugs() {
    return prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true },
    });
  }

  private static buildOrderBy(sort: SortOption) {
    switch (sort) {
      case "price_asc":
        return { price: "asc" as const };
      case "price_desc":
        return { price: "desc" as const };
      case "name_asc":
        return { name: "asc" as const };
      case "popularity":
      default:
        return { sortOrder: "asc" as const };
    }
  }
}
