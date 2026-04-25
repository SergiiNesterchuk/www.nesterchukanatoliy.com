import { ProductRepository } from "@/repositories/ProductRepository";
import type { ProductListItem, ProductDetail } from "@/entities/product";
import type { SortOption } from "@/shared/constants";
import { NotFoundError } from "@/shared/errors";

export class ProductService {
  static async getBySlug(slug: string): Promise<ProductDetail> {
    const product = await ProductRepository.findBySlug(slug);
    if (!product) throw new NotFoundError("Product", slug);
    return this.toDetail(product);
  }

  static async getList(options: {
    categorySlug?: string;
    sort?: SortOption;
    page?: number;
    limit?: number;
  }) {
    const result = await ProductRepository.findMany(options);
    const items = result.items.map(this.toListItem);
    return {
      items: await this.enrichWithRatings(items),
      total: result.total,
      page: result.page,
      pages: result.pages,
    };
  }

  static async getAll() {
    const products = await ProductRepository.findAll();
    const items = products.map(this.toListItem);
    return this.enrichWithRatings(items);
  }

  /** Batch fetch average ratings for product list */
  private static async enrichWithRatings(items: ProductListItem[]): Promise<ProductListItem[]> {
    if (items.length === 0) return items;
    try {
      const { prisma } = await import("@/shared/db");
      const ids = items.map((i) => i.id);
      const ratings = await prisma.productReview.groupBy({
        by: ["productId"],
        where: { productId: { in: ids }, status: "approved" },
        _avg: { rating: true },
      });
      const ratingMap = new Map(ratings.map((r) => [r.productId, r._avg.rating || 0]));
      return items.map((item) => ({
        ...item,
        averageRating: Math.round((ratingMap.get(item.id) || 0) * 10) / 10,
      }));
    } catch {
      return items; // fallback: 0 ratings
    }
  }

  static async getAllSlugs() {
    return ProductRepository.findAllSlugs();
  }

  private static toListItem(product: {
    id: string;
    slug: string;
    name: string;
    sku: string;
    price: number;
    compareAtPrice: number | null;
    stockStatus: string;
    quantity: number | null;
    images: { url: string }[];
    category: { name: string; slug: string };
    _count?: { reviews: number };
  }): ProductListItem {
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      stockStatus: product.stockStatus,
      quantity: product.quantity,
      coverImage: product.images[0]?.url ?? null,
      reviewCount: product._count?.reviews ?? 0,
      averageRating: 0, // enriched later by enrichWithRatings()
      category: product.category,
    };
  }

  private static toDetail(product: {
    id: string;
    slug: string;
    name: string;
    sku: string;
    shortDescription: string | null;
    description: string | null;
    price: number;
    compareAtPrice: number | null;
    stockStatus: string;
    quantity: number | null;
    metaTitle: string | null;
    metaDesc: string | null;
    images: { id: string; url: string; alt: string | null; sortOrder: number }[];
    category: { id: string; name: string; slug: string };
    createdAt: Date;
    updatedAt: Date;
  }): ProductDetail {
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      shortDescription: product.shortDescription,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      stockStatus: product.stockStatus,
      quantity: product.quantity,
      metaTitle: product.metaTitle,
      metaDesc: product.metaDesc,
      images: product.images,
      category: product.category,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
