import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/shared/storage";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: { message: "No file" } }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to cloud storage
    const url = await uploadFile(buffer, file.name, "uploads", file.type);

    return NextResponse.json({
      success: true,
      data: { url, fileName: file.name },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("Upload error:", message);
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
