import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { query, insert, queryOne } from '@/lib/db.js';

export async function GET(request, { params }) {
  try {
    const user = await requireSession();
    const { id: channelId } = await params;
    const after = request.nextUrl.searchParams.get('after');

    const isMember = await queryOne(
      'SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, user.id]
    );
    if (!isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    let sql = `SELECT m.*, u.name as author_name, u.email as author_email, u.avatar_url as author_avatar
               FROM messages m LEFT JOIN users u ON u.id = m.user_id
               WHERE m.channel_id = ?`;
    const params2 = [channelId];

    if (after) {
      sql += ' AND m.id > ?';
      params2.push(after);
    }

    sql += ' ORDER BY m.created_at ASC LIMIT 100';

    const messages = await query(sql, params2);

    await query(
      'UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = ? AND user_id = ?',
      [channelId, user.id]
    );

    return NextResponse.json(messages);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

export async function POST(request, { params }) {
  try {
    const user = await requireSession();
    const { id: channelId } = await params;
    const { body, threadId } = await request.json();

    if (!body?.trim()) {
      return NextResponse.json({ error: 'Message body required' }, { status: 400 });
    }

    const isMember = await queryOne(
      'SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, user.id]
    );
    if (!isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const msgId = await insert(
      'INSERT INTO messages (channel_id, user_id, body, thread_id) VALUES (?, ?, ?, ?)',
      [channelId, user.id, body.trim(), threadId || null]
    );

    const message = await queryOne(
      `SELECT m.*, u.name as author_name, u.email as author_email, u.avatar_url as author_avatar
       FROM messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.id = ?`,
      [msgId]
    );

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
