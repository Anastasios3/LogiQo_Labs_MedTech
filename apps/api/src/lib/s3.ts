import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const BUCKET = process.env.S3_BUCKET!;

// Optional — when set, all server-side uploads use this specific CMK instead of
// the bucket's default KMS key. The bucket policy (DenyNonKMSUploads) enforces
// that the correct key is always used regardless of this setting.
const KMS_KEY_ID = process.env.KMS_KEY_ID;

// Pre-signed URLs expire after 15 minutes — HIPAA best practice
const PRESIGNED_URL_TTL_SECONDS = 15 * 60;

// ── Pre-signed URL helpers (client-side upload / download) ────────────────────

export async function getPresignedDownloadUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
}

export async function getPresignedUploadUrl(
  s3Key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
    ServerSideEncryption: "aws:kms",
    ...(KMS_KEY_ID ? { SSEKMSKeyId: KMS_KEY_ID } : {}),
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
}

// ── Server-side upload / delete (multipart form handling) ─────────────────────

/**
 * Upload a Buffer directly to S3 with KMS server-side encryption.
 * Used by POST /devices/:id/documents when the API receives a multipart upload.
 * The file never touches the filesystem — it is buffered in memory and streamed
 * straight to S3. Acceptable for the 10 MB document limit; for larger files use
 * multipart upload parts via the AWS SDK directly.
 */
export async function uploadDocument(
  s3Key: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: mimeType,
    ServerSideEncryption: "aws:kms",
    ...(KMS_KEY_ID ? { SSEKMSKeyId: KMS_KEY_ID } : {}),
  });
  await s3.send(command);
}

/**
 * Delete a single S3 object by key.
 * Called when a DeviceDocument record is superseded (isCurrent flipped to false)
 * or when an upload is rolled back after a DB failure.
 */
export async function deleteDocument(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  });
  await s3.send(command);
}
