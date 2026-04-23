import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const fileName = segments.join("/");

    // Security: prevent path traversal
    if (fileName.includes("..") || fileName.includes("~")) {
      return new NextResponse("Not found", { status: 404 });
    }

    const filePath = path.join(process.cwd(), "public", "uploads", fileName);
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = MIME_TYPES[ext];

    if (!mimeType) {
      return new NextResponse("Not found", { status: 404 });
    }

    const file = await readFile(filePath);

    return new NextResponse(file, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
