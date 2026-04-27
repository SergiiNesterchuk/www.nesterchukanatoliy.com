import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { successResponse, errorResponse } from "@/shared/api-response";
import { deleteFile } from "@/shared/storage";

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
    if (body.slug) body.slug = body.slug.replace(/^\/+/, "").replace(/\/+$/, "").replace(/--+/g, "-").trim().toLowerCase();
    // Якщо cover image змінюється — видалити старе з R2
    if (body.coverImageUrl !== undefined) {
      const old = await prisma.blogPost.findUnique({ where: { id }, select: { coverImageUrl: true } });
      if (old?.coverImageUrl && old.coverImageUrl !== body.coverImageUrl) {
        deleteFile(old.coverImageUrl).catch(() => {});
      }
    }
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
    const post = await prisma.blogPost.findUnique({ where: { id }, select: { coverImageUrl: true } });
    await prisma.blogPost.delete({ where: { id } });
    // Видалити cover image з R2
    if (post?.coverImageUrl) {
      deleteFile(post.coverImageUrl).catch(() => {});
    }
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
});
