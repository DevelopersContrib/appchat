import 'server-only';
import { query } from './db.js';
import { requireMembership } from './tenant.js';

// MySQL full-text ignores words shorter than this (innodb_ft_min_token_size); those fall back to LIKE.
const FT_MIN = 3;

function parseMeta(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return {}; }
}

/** Builds "every word must appear" conditions: full-text for normal words, LIKE for very short ones. */
function textCondition(column, q) {
  const words = q.toLowerCase().match(/[\p{L}\p{N}_'-]+/gu) || [];
  const long = words.filter((w) => w.length >= FT_MIN).map((w) => w.replace(/['-]/g, ''));
  const short = words.filter((w) => w.length < FT_MIN);
  const parts = [];
  const params = [];
  if (long.length) {
    parts.push(`MATCH(${column}) AGAINST(? IN BOOLEAN MODE)`);
    params.push(long.map((w) => `+${w}*`).join(' '));
  }
  for (const w of short) {
    parts.push(`${column} LIKE ?`);
    params.push(`%${w}%`);
  }
  // A quoted phrase must match exactly.
  const phrase = /"([^"]{2,})"/.exec(q)?.[1];
  if (phrase) {
    parts.push(`${column} LIKE ?`);
    params.push(`%${phrase}%`);
  }
  return { sql: parts.join(' AND '), params, ranked: long.length ? { sql: `MATCH(${column}) AGAINST(? IN BOOLEAN MODE)`, param: params[0] } : null };
}

/**
 * Search messages or files the user can see in a workspace.
 * { tenantSlug, q, type: 'messages'|'files', channelId, fromId, sort: 'relevant'|'recent', limit }
 */
export async function searchMessages(user, { tenantSlug, q: rawQ = '', type: rawType = 'messages', channelId: rawChannel, fromId: rawFrom, sort = 'relevant', limit = 60 }) {
  const m = await requireMembership(tenantSlug, user.id).catch(() => null);
  if (!m) throw Object.assign(new Error('Not a member of that workspace'), { status: 403 });

  const q = String(rawQ || '').trim().slice(0, 200);
  const type = rawType === 'files' ? 'files' : 'messages';
  const channelId = Number(rawChannel) || null;
  const fromId = Number(rawFrom) || null;
  const recent = sort === 'recent';
  if (q.length < 2 && !fromId && !(type === 'files' && channelId)) return [];
  const where = ['c.tenant_id = ?', 'm.deleted_at IS NULL', 'c.archived_at IS NULL'];
  const params = [m.tenant_id];
  let order = 'm.created_at DESC';
  const selectParams = [];
  let scoreSql = '0';

  if (type === 'messages') {
    where.push("m.type IN ('text', 'ai')");
    if (q.length >= 2) {
      const t = textCondition('m.body', q);
      if (t.sql) {
        where.push(t.sql);
        params.push(...t.params);
      }
      if (t.ranked && !recent) {
        scoreSql = t.ranked.sql;
        selectParams.push(t.ranked.param);
        order = 'score DESC, m.created_at DESC';
      }
    }
  } else if (q.length >= 2) {
    const t = textCondition('a.title', q);
    if (t.sql) {
      where.push(t.sql);
      params.push(...t.params);
    }
  }
  if (channelId) {
    where.push('c.id = ?');
    params.push(channelId);
  }
  if (fromId) {
    where.push('m.user_id = ?');
    params.push(fromId);
  }

  const fileJoin = type === 'files' ? 'JOIN message_attachments a ON a.message_id = m.id' : '';
  const fileCols = type === 'files' ? ', a.id AS attachment_id, a.title AS file_title, a.url AS file_url, a.mime_type AS file_mime, a.size_bytes AS file_size, a.type AS file_type' : '';

  const rows = await query(
    `SELECT m.id, m.channel_id, m.thread_id, m.body, m.created_at, m.user_id, m.metadata,
            COALESCE(NULLIF(u.name, ''), u.email) AS author,
            c.name AS channel_name, c.is_dm, c.is_private,
            (SELECT COALESCE(NULLIF(pu.name, ''), pu.email) FROM channel_members pm JOIN users pu ON pu.id = pm.user_id
              WHERE pm.channel_id = c.id AND pm.user_id <> ? LIMIT 1) AS dm_peer,
            ${scoreSql} AS score ${fileCols}
     FROM messages m
     JOIN channels c ON c.id = m.channel_id
     JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ?
     LEFT JOIN users u ON u.id = m.user_id
     ${fileJoin}
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}
     LIMIT ${Math.min(Number(limit) || 60, 100)}`,
    [user.id, ...selectParams, user.id, ...params]
  );

  const results = rows.map((r) => {
    const meta = parseMeta(r.metadata);
    return {
      id: r.id,
      channelId: r.channel_id,
      threadId: r.thread_id,
      where: r.is_dm ? `DM with ${r.dm_peer || 'yourself'}` : `${r.is_private ? '🔒' : '#'}${r.channel_name}`,
      author: r.author || meta.author?.name || 'Unknown',
      source: meta.source || null,
      body: String(r.body || '').slice(0, 400),
      createdAt: r.created_at,
      url: `/${m.slug}/c/${r.channel_id}?m=${r.thread_id || r.id}${r.thread_id ? `&t=${r.thread_id}` : ''}`,
      ...(type === 'files' && { file: { id: r.attachment_id, title: r.file_title, url: r.file_url, mime: r.file_mime, size: r.file_size, type: r.file_type } }),
    };
  });
  return results;
}
