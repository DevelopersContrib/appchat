import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query, queryOne } from '@/lib/db.js';
import { audit } from '@/lib/workspace.js';

// Delete a message: its author, or a workspace owner/admin (moderation). Soft delete, logged when a moderator does it.
export async function DELETE(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: channelId, messageId } = await params;

  const msg = await queryOne(
    `SELECT m.id, m.user_id, m.body, c.tenant_id, tm.role
     FROM messages m
     JOIN channels c ON c.id = m.channel_id
     LEFT JOIN tenant_members tm ON tm.tenant_id = c.tenant_id AND tm.user_id = ?
     WHERE m.id = ? AND m.channel_id = ? AND m.deleted_at IS NULL`,
    [user.id, messageId, channelId]
  );
  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

  const isAuthor = msg.user_id === user.id;
  const isModerator = ['owner', 'admin'].includes(msg.role) || user.is_admin;
  if (!isAuthor && !isModerator) return NextResponse.json({ error: "You can't delete that message" }, { status: 403 });

  await query('UPDATE messages SET deleted_at = NOW(), deleted_by = ? WHERE id = ?', [user.id, msg.id]);
  if (!isAuthor) {
    await audit(msg.tenant_id, user.id, 'message.delete', `message ${msg.id}`, { channelId: Number(channelId), excerpt: String(msg.body).slice(0, 140) });
  }
  return NextResponse.json({ ok: true });
}
