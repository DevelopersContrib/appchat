import 'server-only';
import { query, queryOne, insert } from './db.js';
import { assertCanPost, applyWordFilter } from './workspace.js';
import { findMentions, hydrateMessages, MESSAGE_SELECT } from './messages.js';
import { pushToChannelRecipients } from './push.js';
import { notifyOfflineDmRecipients, notifyMentions } from './notify.js';

/**
 * Posts a plain text message as `user` (used by the AI connector). Same rules as the app:
 * channel membership, mutes, blocked words, @mentions and notifications. `via` labels the source.
 */
export async function postTextMessage(user, channelId, rawBody, { via, threadId } = {}) {
  const member = await queryOne('SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?', [channelId, user.id]);
  if (!member) throw Object.assign(new Error('You are not a member of that channel'), { status: 403 });
  const settings = await assertCanPost(channelId, user.id);
  const body = applyWordFilter(String(rawBody || '').trim().slice(0, 10000), settings.bannedWords);
  if (!body) throw new Error('Message is empty');

  let thread = null;
  if (threadId) {
    const parent = await queryOne('SELECT id, thread_id FROM messages WHERE id = ? AND channel_id = ? AND deleted_at IS NULL', [threadId, channelId]);
    if (!parent) throw new Error('Thread not found');
    thread = parent.thread_id || parent.id;
  }

  const members = await query(
    "SELECT u.id, NULLIF(u.name, '') AS name, u.email FROM channel_members cm JOIN users u ON u.id = cm.user_id WHERE cm.channel_id = ?",
    [channelId]
  );
  const mentions = findMentions(body, members);
  const msgId = await insert(
    'INSERT INTO messages (channel_id, user_id, body, thread_id, metadata) VALUES (?, ?, ?, ?, ?)',
    [channelId, user.id, body, thread, JSON.stringify({ via, mentions: mentions.userIds, mentionsEveryone: mentions.everyone })]
  );
  if (thread) await query('UPDATE messages SET updated_at = NOW(3) WHERE id = ?', [thread]);

  const ctx = { channelId: Number(channelId), messageId: msgId, sender: user, body, mentions };
  await pushToChannelRecipients(ctx).catch(() => {});
  if (settings.emailOfflineDms !== false) await notifyOfflineDmRecipients(ctx).catch(() => {});
  if (mentions.userIds.length) await notifyMentions(ctx).catch(() => {});

  const [message] = await hydrateMessages(await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [msgId]), user.id);
  return message;
}
