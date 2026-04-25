import { NextRequest } from "next/server";
import { ProductService } from "@/services/ProductService";
import { prisma } from "@/shared/db";
import { successResponse, errorResponse } from "@/shared/api-response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Try by slug first, then by ID (for repeat order)
    try {
      const product = await ProductService.getBySlug(slug);
      return successResponse(product);
    } catch {
      // Fallback: try by ID
      const product = await prisma.product.findUnique({
        where: { id: slug, isActive: true },
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          category: { select: { id: true, name: true, slug: true } },
        },
      });
      if (product) return successResponse(product);
      return errorResponse(new Error("Product not found"));
    }
  } catch (error) {
    return errorResponse(error);
  }
}
