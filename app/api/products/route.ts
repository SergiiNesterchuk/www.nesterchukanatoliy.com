import { NextRequest } from "next/server";
import { ProductService } from "@/services/ProductService";
import { productQuerySchema } from "@/validators/product.schema";
import { successResponse, errorResponse } from "@/shared/api-response";

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = productQuerySchema.parse(searchParams);

    const result = await ProductService.getList({
      categorySlug: query.category,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    });

    return successResponse(result.items, {
      total: result.total,
      page: result.page,
      pages: result.pages,
      limit: query.limit,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
