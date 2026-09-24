import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { getPool, query } from '@/lib/db.js';
import { requireTenantAdmin, getTenantBySlug } from '@/lib/tenant.js';
import { getObjectBytes, importKeyPrefix, tenantDomain } from '@/lib/storage.js';
import { readSlackExport, importSlackChannel } from '@/lib/slack-import.js';
import { audit } from '@/lib/workspace.js';

export const maxDuration = 300;

// Step 3: import one channel from the export (the browser calls this per selected channel).
export async function POST(request) {
  const user = await requireSession().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const admin = await requireTenantAdmin(b.tenant, user).catch(() => null);
  if (!admin) return NextResponse.json({ error: 'Only workspace admins can import' }, { status: 403 });

  const tenant = await getTenantBySlug(b.tenant);
  if (!String(b.key || '').startsWith(importKeyPrefix(tenantDomain(tenant), tenant.id))) {
    return NextResponse.json({ error: 'Unknown export' }, { status: 404 });
  }

  const conn = await getPool().getConnection();
  try {
    const exp = readSlackExport(await getObjectBytes(b.key));
    const channel = exp.channels.find((c) => c.id === b.channelId);
    if (!channel) return NextResponse.json({ error: 'Channel not in this export' }, { status: 404 });

    // Match Slack authors to AppChat members by email.
    const emails = [...new Set([...exp.users.values()].map((u) => u.email).filter(Boolean))];
    const members = emails.length
      ? await query(
          `SELECT u.id, LOWER(u.email) AS email FROM users u JOIN tenant_members tm ON tm.user_id = u.id
           WHERE tm.tenant_id = ? AND LOWER(u.email) IN (?)`,
          [tenant.id, emails]
        )
      : [];
    const emailToUserId = new Map(members.map((m) => [m.email, m.id]));

    const { channelId, imported } = await importSlackChannel(conn, { tenantId: tenant.id, exp, channel, emailToUserId });
    if (imported > 0) {
      await conn.query('INSERT INTO messages (channel_id, body, type) VALUES (?, ?, ?)', [channelId, `${imported} messages imported from Slack #${channel.name}`, 'system']);
      await audit(tenant.id, user.id, 'import.slack', `#${channel.name}`, { imported });
    }
    return NextResponse.json({ channelId, imported });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 400 });
  } finally {
    conn.release();
  }
}
