import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { successResponse, errorResponse } from "@/shared/api-response";
import { uploadFile, deleteFile } from "@/shared/storage";

export const POST = adminGuard(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return errorResponse(new Error("Файл не обрано"));
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to cloud storage (S3/R2)
    const imageUrl = await uploadFile(buffer, file.name, `products/${id}`, file.type);

    const maxSort = await prisma.productImage.findFirst({
      where: { productId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const image = await prisma.productImage.create({
      data: {
        productId: id,
        url: imageUrl,
        alt: file.name.replace(/\.\w+$/, ""),
        sortOrder: (maxSort?.sortOrder ?? -1) + 1,
      },
    });

    return successResponse(image, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
});

export const DELETE = adminGuard(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const imageId = body.imageId;

    if (!imageId) return errorResponse(new Error("imageId required"));

    // Get image URL before deleting from DB
    const image = await prisma.productImage.findUnique({ where: { id: imageId } });

    await prisma.productImage.delete({
      where: { id: imageId, productId: id },
    });

    // Delete from cloud storage
    if (image?.url) {
      await deleteFile(image.url);
    }

    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
});
