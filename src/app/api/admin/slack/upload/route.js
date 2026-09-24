import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { requireTenantAdmin, getTenantBySlug } from '@/lib/tenant.js';
import { createImportUploadUrl, isStorageConfigured, tenantDomain } from '@/lib/storage.js';

const MAX_EXPORT_BYTES = 250 * 1024 * 1024;

// Step 1: a signed URL so the admin's browser can upload the Slack export straight to storage.
export async function POST(request) {
  const user = await requireSession().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { tenant: slug, size } = await request.json().catch(() => ({}));
  const admin = await requireTenantAdmin(slug, user).catch(() => null);
  if (!admin) return NextResponse.json({ error: 'Only workspace admins can import' }, { status: 403 });
  if (!isStorageConfigured()) return NextResponse.json({ error: 'File storage is not set up' }, { status: 503 });
  const bytes = Number(size);
  if (!(bytes > 0) || bytes > MAX_EXPORT_BYTES) {
    return NextResponse.json({ error: 'Slack exports up to 250 MB are supported' }, { status: 413 });
  }
  const tenant = await getTenantBySlug(slug);
  return NextResponse.json(await createImportUploadUrl({ domain: tenantDomain(tenant), tenantId: tenant.id, size: bytes }));
}
