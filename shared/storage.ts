import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createLogger } from "./logger";
import crypto from "crypto";

const logger = createLogger("Storage");

let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (s3Client) return s3Client;

  const rawEndpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const region = process.env.S3_REGION || "auto";

  if (!rawEndpoint || !accessKey || !secretKey) {
    return null;
  }

  // Strip trailing slashes and any path segments from endpoint
  // S3_ENDPOINT must be just the origin: https://ACCOUNT.r2.cloudflarestorage.com
  const endpoint = rawEndpoint.replace(/\/+$/, "").replace(/\/[^/]+$/, (match) => {
    // Only strip if it looks like a bucket name appended (not part of domain)
    const url = new URL(rawEndpoint);
    return url.pathname.length > 1 ? "" : match;
  });

  // Clean approach: parse and use only origin
  let cleanEndpoint: string;
  try {
    const parsed = new URL(rawEndpoint);
    cleanEndpoint = parsed.origin;
  } catch {
    cleanEndpoint = rawEndpoint.replace(/\/+$/, "");
  }

  s3Client = new S3Client({
    region,
    endpoint: cleanEndpoint,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true,
  });

  logger.info("S3 client initialized", { endpoint: cleanEndpoint, region });

  return s3Client;
}

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

/**
 * Upload a file to cloud storage (S3/R2).
 * Returns the public URL of the uploaded file.
 */
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  folder: string = "products",
  clientMimeType?: string
): Promise<string> {
  const ext = originalName.toLowerCase().match(/\.\w+$/)?.[0] || ".jpg";

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Тип файлу ${ext} не підтримується. Дозволено: ${[...ALLOWED_EXTENSIONS].join(", ")}`);
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Файл занадто великий (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Максимум: 10MB`);
  }

  const client = getS3Client();
  const bucket = process.env.S3_BUCKET;
  const publicUrl = process.env.S3_PUBLIC_URL?.replace(/\/+$/, "");

  if (!client || !bucket || !publicUrl) {
    throw new Error(
      "Cloud storage not configured. Set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_PUBLIC_URL."
    );
  }

  const uniqueId = crypto.randomUUID();
  const key = `${folder}/${uniqueId}${ext}`;

  const contentType =
    (clientMimeType && clientMimeType.startsWith("image/") ? clientMimeType : null)
    || MIME_MAP[ext]
    || "application/octet-stream";

  logger.info("Uploading file", { bucket, key, contentType, size: buffer.length });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const url = `${publicUrl}/${key}`;

  logger.info("File uploaded", { key, size: buffer.length, url });

  return url;
}

/**
 * Delete a file from cloud storage by its public URL.
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  const client = getS3Client();
  const bucket = process.env.S3_BUCKET;
  const publicUrl = process.env.S3_PUBLIC_URL?.replace(/\/+$/, "");

  if (!client || !bucket || !publicUrl) return;

  // Extract key from public URL
  if (!fileUrl.startsWith(publicUrl)) {
    logger.warn("Cannot delete: URL does not match S3_PUBLIC_URL", { fileUrl });
    return;
  }

  const key = fileUrl.substring(publicUrl.length + 1); // +1 for the /
  if (!key) return;

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    logger.info("File deleted from storage", { key });
  } catch (error) {
    logger.warn("Failed to delete file from storage", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check if cloud storage is configured.
 */
export function isStorageConfigured(): boolean {
  return !!(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY &&
    process.env.S3_SECRET_KEY &&
    process.env.S3_BUCKET &&
    process.env.S3_PUBLIC_URL
  );
}
