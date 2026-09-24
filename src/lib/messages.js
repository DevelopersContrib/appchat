import 'server-only';
import { query } from './db.js';

// Columns every message payload uses. Thread replies (thread_id set) live in the thread panel,
// not the main timeline.
export const MESSAGE_SELECT = `SELECT m.id, m.channel_id, m.user_id, m.body, m.type, m.thread_id, m.reply_to_id, m.metadata,
       m.edited_at, m.created_at, m.updated_at, m.deleted_at,
       u.name AS author_name, u.email AS author_email, u.avatar_url AS author_avatar
  FROM messages m LEFT JOIN users u ON u.id = m.user_id`;

/**
 * Adds attachments, reactions ([{ emoji, count, mine, names }]), reply quote (replyTo),
 * and thread stats (reply_count, last_reply_at) to message rows.
 */
export async function hydrateMessages(messages, viewerId) {
  if (!messages.length) return messages;
  const ids = messages.map((m) => m.id);
  const ph = ids.map(() => '?').join(',');

  const [attachments, reactions, threadStats, votes] = await Promise.all([
    query(`SELECT * FROM message_attachments WHERE message_id IN (${ph})`, ids),
    query(
      `SELECT r.message_id, r.emoji, r.user_id, COALESCE(NULLIF(u.name, ''), u.email) AS name
       FROM message_reactions r JOIN users u ON u.id = r.user_id
       WHERE r.message_id IN (${ph}) ORDER BY r.created_at`,
      ids
    ),
    query(
      `SELECT thread_id, COUNT(*) AS reply_count, MAX(created_at) AS last_reply_at
       FROM messages WHERE thread_id IN (${ph}) AND deleted_at IS NULL GROUP BY thread_id`,
      ids
    ),
    query(`SELECT message_id, user_id, option_index FROM poll_votes WHERE message_id IN (${ph})`, ids),
  ]);

  const replyToIds = [...new Set(messages.map((m) => m.reply_to_id).filter(Boolean))];
  const quoted = replyToIds.length
    ? await query(
        `SELECT m.id, m.body, m.deleted_at, m.metadata, COALESCE(NULLIF(u.name, ''), u.email) AS author
         FROM messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.id IN (${replyToIds.map(() => '?').join(',')})`,
        replyToIds
      )
    : [];

  const group = (rows, key) => rows.reduce((acc, r) => ((acc[r[key]] ||= []).push(r), acc), {});
  const attachBy = group(attachments, 'message_id');
  const reactBy = group(reactions, 'message_id');
  const threadBy = Object.fromEntries(threadStats.map((t) => [t.thread_id, t]));
  const quoteBy = Object.fromEntries(quoted.map((q) => [q.id, q]));
  const votesBy = group(votes, 'message_id');

  for (const m of messages) {
    m.attachments = attachBy[m.id] || [];
    const byEmoji = {};
    for (const r of reactBy[m.id] || []) {
      const e = (byEmoji[r.emoji] ||= { emoji: r.emoji, count: 0, mine: false, names: [] });
      e.count++;
      e.names.push(r.name);
      if (r.user_id === viewerId) e.mine = true;
    }
    m.reactions = Object.values(byEmoji);
    const card = parseMeta(m.metadata).card;
    if (card?.kind === 'poll') {
      const counts = card.options.map(() => 0);
      let myVote = null;
      for (const v of votesBy[m.id] || []) {
        if (counts[v.option_index] !== undefined) counts[v.option_index]++;
        if (v.user_id === viewerId) myVote = v.option_index;
      }
      m.poll = { counts, total: counts.reduce((a, b) => a + b, 0), myVote };
    }
    m.reply_count = Number(threadBy[m.id]?.reply_count || 0);
    m.last_reply_at = threadBy[m.id]?.last_reply_at || null;
    if (m.reply_to_id) {
      const q = quoteBy[m.reply_to_id];
      const importedAuthor = q && !q.author ? parseMeta(q.metadata).author?.name : null;
      m.replyTo = q
        ? { id: q.id, author: q.author || importedAuthor || 'Unknown', excerpt: q.deleted_at ? 'Message deleted' : String(q.body).slice(0, 160) }
        : { id: m.reply_to_id, author: '', excerpt: 'Message unavailable' };
    }
    if (m.deleted_at) {
      // Deleted messages are sent only so open chats can remove them.
      m.body = '';
      m.attachments = [];
      m.reactions = [];
      m.deleted = true;
    }
  }
  return messages;
}

function parseMeta(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}

/**
 * Who a message mentions. Matches "@Full Name", "@firstname" or "@email-name" against the given
 * channel members (longest names first), plus @channel / @here / @everyone.
 */
export function findMentions(body, members) {
  let text = ` ${String(body || '').toLowerCase()} `;
  const everyone = /(^|\s)@(channel|here|everyone)\b/.test(text);
  const ids = new Set();
  const candidates = [];
  for (const m of members) {
    const names = new Set([m.name, m.name?.split(' ')[0], m.email?.split('@')[0]].filter((n) => n && n.length >= 2));
    for (const n of names) candidates.push([n.toLowerCase(), m.id]);
  }
  candidates.sort((a, b) => b[0].length - a[0].length);
  for (const [name, id] of candidates) {
    const re = new RegExp(`(^|[\\s(])@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s.,!?:;)])`, 'g');
    if (re.test(text)) {
      ids.add(id);
      // Consume the match so a shorter name ("@ana") can't also claim "@ana cruz".
      text = text.replace(re, '$1\u0000');
    }
  }
  return { userIds: [...ids], everyone };
}
