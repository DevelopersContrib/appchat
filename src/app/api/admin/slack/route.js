import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { query } from '@/lib/db.js';
import { requireTenantAdmin, getTenantBySlug } from '@/lib/tenant.js';
import { getObjectBytes, importKeyPrefix, tenantDomain } from '@/lib/storage.js';
import { readSlackExport, countMessages, SOURCE } from '@/lib/slack-import.js';

export const maxDuration = 120;

// Step 2: read the uploaded export and list its channels with message counts and import status.
export async function GET(request) {
  const user = await requireSession().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const admin = await requireTenantAdmin(sp.get('tenant'), user).catch(() => null);
  if (!admin) return NextResponse.json({ error: 'Only workspace admins can import' }, { status: 403 });

  const tenant = await getTenantBySlug(sp.get('tenant'));
  const key = sp.get('key') || '';
  // Only files this workspace uploaded.
  if (!key.startsWith(importKeyPrefix(tenantDomain(tenant), tenant.id))) {
    return NextResponse.json({ error: 'Unknown export' }, { status: 404 });
  }
  try {
    const exp = readSlackExport(await getObjectBytes(key));
    const linked = await query(
      `SELECT c.id, c.external_id, COUNT(m.id) AS imported FROM channels c
       LEFT JOIN messages m ON m.channel_id = c.id AND m.source = ?
       WHERE c.tenant_id = ? AND c.source = ? GROUP BY c.id, c.external_id`,
      [SOURCE, tenant.id, SOURCE]
    );
    const byExternal = new Map(linked.map((r) => [r.external_id, r]));
    const emails = [...exp.users.values()].filter((u) => u.email).length;
    return NextResponse.json({
      users: exp.users.size,
      usersWithEmail: emails,
      channels: exp.channels.map((c) => ({
        id: c.id,
        name: c.name,
        isPrivate: c.isPrivate,
        archived: c.archived,
        messages: countMessages(exp, c),
        imported: Number(byExternal.get(c.id)?.imported ?? 0),
        appchatChannelId: byExternal.get(c.id)?.id ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Could not read that file' }, { status: 400 });
  }
}
