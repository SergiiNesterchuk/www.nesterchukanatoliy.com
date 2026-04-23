import { NextRequest } from "next/server";
import { CartService } from "@/services/CartService";
import { cartValidateSchema } from "@/validators/cart.schema";
import { successResponse, errorResponse } from "@/shared/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = cartValidateSchema.parse(body);
    const result = await CartService.validateCart(items);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
