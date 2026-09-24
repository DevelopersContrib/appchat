import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query, queryOne } from '@/lib/db.js';
import { audit, assertCanPost, applyWordFilter } from '@/lib/workspace.js';
import { hydrateMessages, MESSAGE_SELECT, findMentions } from '@/lib/messages.js';
import { sanitizeString } from '@/lib/security.js';

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

// Edit your own message.
export async function PATCH(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: channelId, messageId } = await params;
  const msg = await queryOne(
    "SELECT id, user_id, metadata FROM messages WHERE id = ? AND channel_id = ? AND deleted_at IS NULL AND type = 'text'",
    [messageId, channelId]
  );
  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  if (msg.user_id !== user.id) return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 });

  let settings;
  try {
    settings = await assertCanPost(channelId, user.id);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  const { body: raw } = await request.json().catch(() => ({}));
  const body = applyWordFilter(sanitizeString(raw, 10000).trim(), settings.bannedWords);
  if (!body) return NextResponse.json({ error: 'Message can’t be empty — delete it instead' }, { status: 400 });

  const members = await query(
    "SELECT u.id, NULLIF(u.name, '') AS name, u.email FROM channel_members cm JOIN users u ON u.id = cm.user_id WHERE cm.channel_id = ?",
    [channelId]
  );
  const mentions = findMentions(body, members);
  const meta = { ...(typeof msg.metadata === 'string' ? JSON.parse(msg.metadata || '{}') : msg.metadata || {}), mentions: mentions.userIds, mentionsEveryone: mentions.everyone };
  await query('UPDATE messages SET body = ?, edited_at = NOW(), metadata = ? WHERE id = ?', [body, JSON.stringify(meta), msg.id]);
  const [message] = await hydrateMessages(await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [msg.id]), user.id);
  return NextResponse.json(message);
}
