import { CategoryService } from "@/services/CategoryService";
import { successResponse, errorResponse } from "@/shared/api-response";

export async function GET() {
  try {
    const categories = await CategoryService.getAll();
    return successResponse(categories);
  } catch (error) {
    return errorResponse(error);
  }
}
