import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { successResponse, errorResponse } from "@/shared/api-response";

export const GET = adminGuard(async () => {
  try {
    const posts = await prisma.blogPost.findMany({ orderBy: { sortOrder: "asc" } });
    return successResponse(posts);
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = adminGuard(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const post = await prisma.blogPost.create({ data: body });
    return successResponse(post, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
