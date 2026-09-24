import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query, queryOne } from '@/lib/db.js';
import { hydrateMessages, MESSAGE_SELECT } from '@/lib/messages.js';
import { rateLimit } from '@/lib/security.js';

// Toggle an emoji reaction on a message. Returns the updated message.
export async function POST(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!rateLimit(`react:${user.id}`, 60, 60000)) return NextResponse.json({ error: 'Slow down' }, { status: 429 });
  const { id: channelId, messageId } = await params;
  const { emoji } = await request.json().catch(() => ({}));
  // One emoji (may be several code points, e.g. flags or skin tones), no text.
  if (typeof emoji !== 'string' || !emoji || emoji.length > 16 || /[\p{L}\p{N}\s<>]/u.test(emoji)) {
    return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 });
  }
  const ok = await queryOne(
    `SELECT 1 FROM messages m JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = ?
     WHERE m.id = ? AND m.channel_id = ? AND m.deleted_at IS NULL`,
    [user.id, messageId, channelId]
  );
  if (!ok) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

  const removed = await query('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?', [messageId, user.id, emoji]);
  if (!removed.affectedRows) {
    await query('INSERT IGNORE INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)', [messageId, user.id, emoji]);
  }
  // Bump the message so everyone's open chat picks up the change.
  await query('UPDATE messages SET updated_at = NOW(3) WHERE id = ?', [messageId]);
  const [message] = await hydrateMessages(await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [messageId]), user.id);
  return NextResponse.json(message);
}
