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
    return {
      items: result.items.map(this.toListItem),
      total: result.total,
      page: result.page,
      pages: result.pages,
    };
  }

  static async getAll() {
    const products = await ProductRepository.findAll();
    return products.map(this.toListItem);
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
