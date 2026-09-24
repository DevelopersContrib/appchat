import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query, queryOne } from '@/lib/db.js';
import { hydrateMessages, MESSAGE_SELECT } from '@/lib/messages.js';

// Vote on a poll (voting for your current choice again removes your vote).
export async function POST(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: channelId, messageId } = await params;
  const msg = await queryOne(
    `SELECT m.id, m.metadata FROM messages m JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = ?
     WHERE m.id = ? AND m.channel_id = ? AND m.deleted_at IS NULL`,
    [user.id, messageId, channelId]
  );
  const card = msg && (typeof msg.metadata === 'string' ? JSON.parse(msg.metadata || '{}') : msg.metadata || {}).card;
  if (card?.kind !== 'poll') return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
  const { option } = await request.json().catch(() => ({}));
  const idx = Number(option);
  if (!Number.isInteger(idx) || idx < 0 || idx >= card.options.length) return NextResponse.json({ error: 'Invalid option' }, { status: 400 });

  const current = await queryOne('SELECT option_index FROM poll_votes WHERE message_id = ? AND user_id = ?', [msg.id, user.id]);
  if (current?.option_index === idx) {
    await query('DELETE FROM poll_votes WHERE message_id = ? AND user_id = ?', [msg.id, user.id]);
  } else {
    await query(
      'INSERT INTO poll_votes (message_id, user_id, option_index) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE option_index = VALUES(option_index)',
      [msg.id, user.id, idx]
    );
  }
  await query('UPDATE messages SET updated_at = NOW(3) WHERE id = ?', [msg.id]);
  const [message] = await hydrateMessages(await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [msg.id]), user.id);
  return NextResponse.json(message);
}
