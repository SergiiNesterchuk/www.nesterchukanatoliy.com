import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createLogger } from "./logger";
import crypto from "crypto";

const logger = createLogger("Storage");

let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (s3Client) return s3Client;

  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const region = process.env.S3_REGION || "auto";

  if (!endpoint || !accessKey || !secretKey) {
    return null;
  }

  s3Client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true,
  });

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
  const publicUrl = process.env.S3_PUBLIC_URL;

  if (!client || !bucket || !publicUrl) {
    throw new Error(
      "Cloud storage not configured. Set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_PUBLIC_URL in environment variables."
    );
  }

  const uniqueId = crypto.randomUUID();
  const key = `${folder}/${uniqueId}${ext}`;

  // Priority: client-provided MIME → extension lookup → fallback
  const contentType =
    (clientMimeType && clientMimeType.startsWith("image/") ? clientMimeType : null)
    || MIME_MAP[ext]
    || "application/octet-stream";

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const url = `${publicUrl.replace(/\/+$/, "")}/${key}`;

  logger.info("File uploaded", {
    key,
    size: buffer.length,
    contentType,
    url: url.substring(0, 100),
  });

  return url;
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
