import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { successResponse, errorResponse } from "@/shared/api-response";

export const GET = adminGuard(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) return successResponse(null);
    return successResponse(post);
  } catch (error) {
    return errorResponse(error);
  }
});

export const PUT = adminGuard(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const post = await prisma.blogPost.update({ where: { id }, data: body });
    return successResponse(post);
  } catch (error) {
    return errorResponse(error);
  }
});

export const DELETE = adminGuard(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    await prisma.blogPost.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
});
