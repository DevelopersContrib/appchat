import 'server-only';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';

// Files go to VNOC's per-domain S3 bucket, filed under each workspace's domain: <domain>/appchat/<tenant>/<channel>/...
// Env (same names as vnoc/manage-app): AWS_S3_BUCKET_DOMAIN, AWS_S3_REGION, AWS_S3_ACCESS_KEY_ID, AWS_S3_SECRET_ACCESS_KEY.
const BUCKET = process.env.AWS_S3_BUCKET_DOMAIN;
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024;

// Only these open in the browser; everything else (HTML, SVG, scripts, office docs…) downloads.
const INLINE_TYPES = /^(image\/(png|jpe?g|gif|webp|avif|heic|heif)|application\/pdf|video\/(mp4|webm|quicktime)|audio\/[\w.+-]+|text\/plain)$/i;
export const isInlineType = (contentType) => INLINE_TYPES.test(contentType || '');

let client;
function s3() {
  if (!BUCKET) throw new Error('File uploads are not configured');
  client ??= new S3Client({
    region: process.env.AWS_S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

export function isStorageConfigured() {
  return Boolean(BUCKET && process.env.AWS_S3_ACCESS_KEY_ID);
}

// The workspace's VNOC domain, used as the top-level folder in the bucket.
export function tenantDomain(tenant) {
  return String(tenant.domain || `${tenant.slug}.com`).toLowerCase().replace(/[^a-z0-9.-]/g, '');
}

// Keys carry the channel so downloads can be authorized from the key alone.
export function channelKeyPrefix(domain, tenantId, channelId) {
  return `${domain}/appchat/${tenantId}/${channelId}/`;
}

export function parseChannelFromKey(key) {
  const m = /^[a-z0-9.-]+\/appchat\/(\d+)\/(\d+)\/[\w-]+\/[^/]+$/.exec(key || '');
  return m ? { tenantId: Number(m[1]), channelId: Number(m[2]) } : null;
}

export function safeFilename(name) {
  const cleaned = String(name || 'file').normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(-120);
  return cleaned.replace(/^[.-]+/, '') || 'file';
}

export async function createUploadUrl({ domain, tenantId, channelId, filename, contentType, size }) {
  const key = `${channelKeyPrefix(domain, tenantId, channelId)}${nanoid(16)}/${safeFilename(filename)}`;
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    { expiresIn: 600 }
  );
  return { key, uploadUrl };
}

export async function createDownloadUrl(key, { filename, contentType } = {}) {
  const inline = isInlineType(contentType);
  const name = safeFilename(filename || key.split('/').pop());
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: `${inline ? 'inline' : 'attachment'}; filename="${name}"`,
      ResponseContentType: inline ? contentType : 'application/octet-stream',
    }),
    { expiresIn: 300 }
  );
}

export function fileUrlForKey(key) {
  return `/api/files/${key}`;
}
