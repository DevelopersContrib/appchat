import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query, insert } from '@/lib/db.js';
import { getChannelAccess } from '@/lib/channels.js';

// Join a public channel yourself, or (as a channel member/manager) add people to a channel.
export async function POST(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const access = await getChannelAccess(id, user);
  if (!access?.canView || access.channel.is_dm || access.channel.archived_at) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }
  const b = await request.json().catch(() => ({}));
  const ids = (Array.isArray(b.userIds) && b.userIds.length ? b.userIds : [user.id]).map(Number);
  const addingOthers = ids.some((uid) => uid !== user.id);
  // Private channels: only people already inside (or admins) can add others.
  if (addingOthers && !access.isMember && !access.canManage) {
    return NextResponse.json({ error: 'Join the channel first' }, { status: 403 });
  }
  if (!addingOthers && access.channel.is_private && !access.canManage) {
    return NextResponse.json({ error: 'This channel is private — ask a member to add you' }, { status: 403 });
  }
  const res = await query(
    `INSERT IGNORE INTO channel_members (channel_id, user_id)
     SELECT ?, user_id FROM tenant_members WHERE tenant_id = ? AND user_id IN (?)`,
    [access.channel.id, access.channel.tenant_id, ids]
  );
  if (res.affectedRows) {
    await insert('INSERT INTO messages (channel_id, body, type) VALUES (?, ?, ?)', [
      access.channel.id,
      addingOthers ? `${user.name || user.email} added ${res.affectedRows} ${res.affectedRows === 1 ? 'person' : 'people'}` : `${user.name || user.email} joined`,
      'system',
    ]);
  }
  return NextResponse.json({ ok: true, added: res.affectedRows, url: `/${access.channel.tenant_slug}/c/${access.channel.id}` });
}

// Leave (yourself) or remove someone (channel manager).
export async function DELETE(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const access = await getChannelAccess(id, user);
  if (!access || access.channel.is_dm) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  const targetId = Number(request.nextUrl.searchParams.get('userId') || user.id);
  if (targetId !== user.id && !access.canManage) return NextResponse.json({ error: 'Only the channel creator or an admin can remove people' }, { status: 403 });

  const res = await query('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?', [access.channel.id, targetId]);
  if (res.affectedRows) {
    await insert('INSERT INTO messages (channel_id, body, type) VALUES (?, ?, ?)', [
      access.channel.id,
      targetId === user.id ? `${user.name || user.email} left` : `${user.name || user.email} removed a member`,
      'system',
    ]);
  }
  return NextResponse.json({ ok: true, url: `/${access.channel.tenant_slug}` });
}
