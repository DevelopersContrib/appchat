import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { insert, query } from '@/lib/db.js';
import { getChannelAccess } from '@/lib/channels.js';
import { assertCanPost } from '@/lib/workspace.js';
import { hydrateMessages, MESSAGE_SELECT } from '@/lib/messages.js';
import { sanitizeString, rateLimit } from '@/lib/security.js';

// Create a poll: { question, options: [2–10 strings] }.
export async function POST(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const access = await getChannelAccess(id, user);
  if (!access?.isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  if (!rateLimit(`poll:${user.id}`, 10, 60000)) return NextResponse.json({ error: 'Slow down' }, { status: 429 });
  try {
    await assertCanPost(id, user.id);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  const b = await request.json().catch(() => ({}));
  const question = sanitizeString(b.question, 300);
  const options = (Array.isArray(b.options) ? b.options : []).map((o) => sanitizeString(String(o), 120)).filter(Boolean).slice(0, 10);
  if (!question || options.length < 2) return NextResponse.json({ error: 'A poll needs a question and at least 2 options' }, { status: 400 });

  const msgId = await insert('INSERT INTO messages (channel_id, user_id, body, type, metadata) VALUES (?, ?, ?, ?, ?)', [
    id, user.id, `📊 ${question}\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`, 'text', JSON.stringify({ card: { kind: 'poll', question, options } }),
  ]);
  const [message] = await hydrateMessages(await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [msgId]), user.id);
  return NextResponse.json(message, { status: 201 });
}
