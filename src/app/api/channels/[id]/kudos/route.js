import { NextResponse, after } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { insert, query, queryOne } from '@/lib/db.js';
import { getChannelAccess } from '@/lib/channels.js';
import { assertCanPost } from '@/lib/workspace.js';
import { hydrateMessages, MESSAGE_SELECT } from '@/lib/messages.js';
import { pushToChannelRecipients } from '@/lib/push.js';
import { sanitizeString, rateLimit } from '@/lib/security.js';

// Give kudos: { userId, reason } → a celebration card in the channel, counted on their profile.
export async function POST(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const access = await getChannelAccess(id, user);
  if (!access?.isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  if (!rateLimit(`kudos:${user.id}`, 20, 3600000)) return NextResponse.json({ error: 'That’s a lot of kudos — try again later' }, { status: 429 });
  try {
    await assertCanPost(id, user.id);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  const b = await request.json().catch(() => ({}));
  const to = await queryOne(
    `SELECT u.id, COALESCE(NULLIF(u.name, ''), u.email) AS name FROM tenant_members tm JOIN users u ON u.id = tm.user_id
     WHERE tm.tenant_id = ? AND u.id = ?`,
    [access.channel.tenant_id, b.userId]
  );
  if (!to) return NextResponse.json({ error: 'Pick someone in this workspace' }, { status: 404 });
  if (to.id === user.id) return NextResponse.json({ error: 'Kudos are for other people 🙂' }, { status: 400 });
  const reason = sanitizeString(b.reason, 300);

  const msgId = await insert('INSERT INTO messages (channel_id, user_id, body, type, metadata) VALUES (?, ?, ?, ?, ?)', [
    id,
    user.id,
    `🙌 Kudos to @${to.name}${reason ? ` for ${reason}` : ''}`,
    'text',
    JSON.stringify({ card: { kind: 'kudos', toUserId: to.id, toName: to.name, reason }, mentions: [to.id] }),
  ]);
  await insert('INSERT INTO kudos (tenant_id, from_user_id, to_user_id, message_id) VALUES (?, ?, ?, ?)', [access.channel.tenant_id, user.id, to.id, msgId]);
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM kudos WHERE tenant_id = ? AND to_user_id = ?', [access.channel.tenant_id, to.id]);
  after(() => pushToChannelRecipients({
    channelId: Number(id), sender: user, body: `🙌 ${user.name || user.email} gave you kudos${reason ? ` for ${reason}` : ''}!`, mentions: { userIds: [to.id] },
  }).catch(() => {}));

  const [message] = await hydrateMessages(await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [msgId]), user.id);
  return NextResponse.json({ ...message, kudosTotal: Number(n) }, { status: 201 });
}
