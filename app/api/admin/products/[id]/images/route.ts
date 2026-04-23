import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { successResponse, errorResponse } from "@/shared/api-response";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

    const ext = path.extname(file.name).toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"];
    if (!allowed.includes(ext)) {
      return errorResponse(new Error(`Тип ${ext} не підтримується`));
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), buffer);

    const imageUrl = `/api/uploads/${fileName}`;

    const maxSort = await prisma.productImage.findFirst({
      where: { productId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const image = await prisma.productImage.create({
      data: {
        productId: id,
        url: imageUrl,
        alt: file.name.replace(ext, ""),
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

    await prisma.productImage.delete({
      where: { id: imageId, productId: id },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
});
