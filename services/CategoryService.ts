import { CategoryRepository } from "@/repositories/CategoryRepository";
import type { CategoryListItem, CategoryDetail } from "@/entities/category";
import { NotFoundError } from "@/shared/errors";

export class CategoryService {
  static async getAll(): Promise<CategoryListItem[]> {
    const categories = await CategoryRepository.findAll();
    // Filter: only active categories with at least 1 product
    return categories
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        imageUrl: cat.imageUrl,
        productCount: cat._count.products,
      }))
      .filter((cat) => cat.productCount > 0);
  }

  static async getBySlug(slug: string): Promise<CategoryDetail> {
    const category = await CategoryRepository.findBySlug(slug);
    if (!category) throw new NotFoundError("Category", slug);
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      metaTitle: category.metaTitle,
      metaDesc: category.metaDesc,
    };
  }

  static async getAllSlugs() {
    return CategoryRepository.findAllSlugs();
  }
}
