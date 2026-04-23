import { NextRequest } from "next/server";
import { ProductService } from "@/services/ProductService";
import { successResponse, errorResponse } from "@/shared/api-response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const product = await ProductService.getBySlug(slug);
    return successResponse(product);
  } catch (error) {
    return errorResponse(error);
  }
}
