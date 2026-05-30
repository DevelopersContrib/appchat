import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { query, insert } from '@/lib/db.js';
import { requireMembership } from '@/lib/tenant.js';

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

export async function POST(request) {
  try {
    const user = await requireSession();
    const { tenant: tenantSlug, name, description, isPrivate } = await request.json();
    const membership = await requireMembership(tenantSlug, user.id);

    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only admins can create channels' }, { status: 403 });
    }

    const channelId = await insert(
      'INSERT INTO channels (tenant_id, name, description, is_private, created_by) VALUES (?, ?, ?, ?, ?)',
      [membership.tenant_id, name, description || '', isPrivate ? 1 : 0, user.id]
    );

    await insert(
      'INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)',
      [channelId, user.id]
    );

    await insert(
      'INSERT INTO messages (channel_id, body, type) VALUES (?, ?, ?)',
      [channelId, `Channel #${name} created`, 'system']
    );

    return NextResponse.json({ id: channelId, name });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
