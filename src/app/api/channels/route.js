import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { query, insert, queryOne } from '@/lib/db.js';
import { sanitizeString } from '@/lib/security.js';
import { requireMembership } from '@/lib/tenant.js';
import { channelName } from '@/lib/channels.js';

export async function GET(request) {
  try {
    const user = await requireSession();
    const tenantSlug = request.nextUrl.searchParams.get('tenant');
    const membership = await requireMembership(tenantSlug, user.id);

    const channels = await query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id AND m.created_at > COALESCE(
          (SELECT cm2.last_read_at FROM channel_members cm2 WHERE cm2.channel_id = c.id AND cm2.user_id = ?), '1970-01-01'
        )) as unread_count
       FROM channels c
       JOIN channel_members cm ON cm.channel_id = c.id
       WHERE c.tenant_id = ? AND cm.user_id = ?
       ORDER BY c.name`,
      [user.id, membership.tenant_id, user.id]
    );

    return NextResponse.json(channels);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

// Create a public or private channel. Any member except guests can create one.
export async function POST(request) {
  try {
    const user = await requireSession();
    const body = await request.json();
    const membership = await requireMembership(body.tenant, user.id);
    if (membership.role === 'guest') {
      return NextResponse.json({ error: 'Guests can’t create channels' }, { status: 403 });
    }

    const name = channelName(body.name);
    if (!name) return NextResponse.json({ error: 'Give the channel a name' }, { status: 400 });
    const taken = await queryOne(
      'SELECT id FROM channels WHERE tenant_id = ? AND name = ? AND is_dm = 0 AND archived_at IS NULL',
      [membership.tenant_id, name]
    );
    if (taken) return NextResponse.json({ error: `#${name} already exists` }, { status: 409 });

    const isPrivate = Boolean(body.isPrivate);
    const channelId = await insert(
      'INSERT INTO channels (tenant_id, name, description, is_private, created_by) VALUES (?, ?, ?, ?, ?)',
      [membership.tenant_id, name, sanitizeString(body.description, 500), isPrivate ? 1 : 0, user.id]
    );

    if (isPrivate) {
      // Creator plus the chosen people (who must be in the workspace).
      const ids = [...new Set([user.id, ...(Array.isArray(body.memberIds) ? body.memberIds.map(Number) : [])])];
      await query(
        `INSERT IGNORE INTO channel_members (channel_id, user_id)
         SELECT ?, user_id FROM tenant_members WHERE tenant_id = ? AND user_id IN (?)`,
        [channelId, membership.tenant_id, ids]
      );
    } else {
      await query(
        `INSERT IGNORE INTO channel_members (channel_id, user_id)
         SELECT ?, user_id FROM tenant_members WHERE tenant_id = ?`,
        [channelId, membership.tenant_id]
      );
    }

    await insert(
      'INSERT INTO messages (channel_id, body, type) VALUES (?, ?, ?)',
      [channelId, `${user.name || user.email} created ${isPrivate ? 'private ' : ''}channel #${name}`, 'system']
    );

    return NextResponse.json({ id: channelId, name, url: `/${membership.slug}/c/${channelId}` });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

