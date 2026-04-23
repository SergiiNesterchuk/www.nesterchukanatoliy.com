import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { settingSchema } from "@/validators/admin.schema";
import { successResponse, errorResponse } from "@/shared/api-response";

export const GET = adminGuard(async () => {
  try {
    const settings = await prisma.settings.findMany({ orderBy: { key: "asc" } });
    return successResponse(settings);
  } catch (error) {
    return errorResponse(error);
  }
});

export const PUT = adminGuard(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const data = settingSchema.parse(body);

    const setting = await prisma.settings.upsert({
      where: { key: data.key },
      update: { value: data.value },
      create: { key: data.key, value: data.value },
    });
    return successResponse(setting);
  } catch (error) {
    return errorResponse(error);
  }
});
