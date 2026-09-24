import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { queryOne } from '@/lib/db.js';
import { rateLimit } from '@/lib/security.js';
import { createUploadUrl, isStorageConfigured, tenantDomain, MAX_UPLOAD_BYTES } from '@/lib/storage.js';

// Step 1 of an upload: the browser asks for a short-lived URL, then PUTs the file straight to storage.
export async function POST(request) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'File uploads are not set up on this server yet.' }, { status: 503 });
  }
  if (!rateLimit(`upload:${user.id}`, 30, 60000)) {
    return NextResponse.json({ error: 'Too many uploads. Slow down.' }, { status: 429 });
  }

  const { channelId, filename, contentType, size } = await request.json().catch(() => ({}));
  const bytes = Number(size);
  if (!channelId || !filename || !Number.isFinite(bytes) || bytes <= 0) {
    return NextResponse.json({ error: 'channelId, filename and size are required' }, { status: 400 });
  }
  if (bytes > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `Files can be up to ${Math.round(MAX_UPLOAD_BYTES / 1048576)} MB.` }, { status: 413 });
  }

  const channel = await queryOne(
    `SELECT c.id, c.tenant_id, t.slug, t.domain FROM channels c
     JOIN tenants t ON t.id = c.tenant_id
     JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ?
     WHERE c.id = ?`,
    [user.id, channelId]
  );
  if (!channel) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const type = typeof contentType === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(contentType)
    ? contentType
    : 'application/octet-stream';

  const { key, uploadUrl } = await createUploadUrl({
    domain: tenantDomain(channel),
    tenantId: channel.tenant_id,
    channelId: channel.id,
    filename,
    contentType: type,
    size: bytes,
  });

  return NextResponse.json({ key, uploadUrl, contentType: type });
}
