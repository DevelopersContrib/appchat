import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { getPool } from '@/lib/db.js';
import { requireTenantAdmin } from '@/lib/tenant.js';
import { loadGuild, importChannelStep } from '@/lib/discord-import.js';
import { rateLimit } from '@/lib/security.js';

export const maxDuration = 60;

// One import step for one channel (up to 500 messages). The browser calls this in a loop until done.
export async function POST(request) {
  const user = await requireSession().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const admin = await requireTenantAdmin(body.tenant, user).catch(() => null);
  if (!admin) return NextResponse.json({ error: 'Only workspace admins can import' }, { status: 403 });
  if (!rateLimit(`discord-import:${admin.tenant_id}`, 60, 60000)) {
    return NextResponse.json({ error: 'Slow down — try again in a minute.' }, { status: 429 });
  }

  const conn = await getPool().getConnection();
  try {
    const guild = await loadGuild(String(body.guild || ''));
    const dc = guild.channels.find((c) => c.id === String(body.channelId));
    if (!dc) return NextResponse.json({ error: 'Channel not found in that server' }, { status: 404 });

    const step = await importChannelStep(conn, { tenantId: admin.tenant_id, guild, dc, maxPages: 5 });
    const total = Number(body.importedSoFar || 0) + step.imported;
    if (step.done && total > 0) {
      await conn.query(
        'INSERT INTO messages (channel_id, body, type) VALUES (?, ?, ?)',
        [step.channelId, `${total} messages imported from Discord #${dc.name}`, 'system']
      );
    }
    return NextResponse.json(step);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  } finally {
    conn.release();
  }
}
