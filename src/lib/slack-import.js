import 'server-only';
import { unzipSync, strFromU8 } from 'fflate';
import { ensureImportedChannel, insertImportedMessages, toMysqlDate } from './import-common.js';

// Slack workspace export (.zip from Slack → Settings → Import/Export Data):
//   users.json, channels.json (public), groups.json (private, when included),
//   <channel name>/<YYYY-MM-DD>.json  — one file per day of messages.
export const SOURCE = 'slack';
const SKIP_SUBTYPES = new Set(['channel_join', 'channel_leave', 'channel_purpose', 'channel_topic', 'channel_name', 'bot_add', 'bot_remove', 'pinned_item', 'group_join', 'group_leave']);

export function readSlackExport(bytes) {
  const files = unzipSync(bytes);
  const read = (name) => {
    const key = Object.keys(files).find((k) => k === name || k.endsWith(`/${name}`));
    return key ? JSON.parse(strFromU8(files[key])) : null;
  };
  const users = read('users.json') || [];
  const publicChannels = (read('channels.json') || []).map((c) => ({ ...c, isPrivate: false }));
  const privateChannels = (read('groups.json') || []).map((c) => ({ ...c, isPrivate: true }));
  if (!publicChannels.length && !privateChannels.length) {
    throw new Error("This doesn't look like a Slack export (no channels.json).");
  }

  const channels = [...publicChannels, ...privateChannels].map((c) => {
    const dayFiles = Object.keys(files)
      .filter((k) => new RegExp(`(^|/)${escapeRe(c.name)}/\\d{4}-\\d{2}-\\d{2}\\.json$`).test(k))
      .sort();
    return {
      id: c.id,
      name: c.name,
      topic: c.purpose?.value || c.topic?.value || '',
      isPrivate: c.isPrivate,
      archived: Boolean(c.is_archived),
      memberSlackIds: c.members || [],
      dayFiles,
    };
  });

  return {
    files,
    users: new Map(users.map((u) => [u.id, {
      name: u.profile?.real_name || u.real_name || u.name || 'Unknown',
      email: u.profile?.email?.toLowerCase() || null,
      avatar: u.profile?.image_72 || null,
      bot: Boolean(u.is_bot),
    }])),
    channels,
    channelNames: new Map(channels.map((c) => [c.id, c.name])),
  };
}

export function countMessages(exp, channel) {
  let n = 0;
  for (const f of channel.dayFiles) {
    for (const m of JSON.parse(strFromU8(exp.files[f]))) if (keep(m)) n++;
  }
  return n;
}

/** Imports one Slack channel. emailToUserId maps Slack users' emails to AppChat user ids. */
export async function importSlackChannel(db, { tenantId, exp, channel, emailToUserId }) {
  const slackToUser = (slackId) => {
    const email = exp.users.get(slackId)?.email;
    return email ? emailToUserId.get(email) || null : null;
  };
  const channelId = await ensureImportedChannel(db, {
    tenantId,
    source: SOURCE,
    externalId: channel.id,
    name: channel.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 80),
    topic: channel.topic,
    isPrivate: channel.isPrivate,
    memberIds: channel.isPrivate ? channel.memberSlackIds.map(slackToUser).filter(Boolean) : null,
  });

  // Parent messages by ts, so thread replies can show what they reply to.
  const byTs = new Map();
  let imported = 0;
  let batch = [];
  const flush = async () => {
    imported += await insertImportedMessages(db, channelId, SOURCE, batch);
    batch = [];
  };

  for (const f of channel.dayFiles) {
    for (const m of JSON.parse(strFromU8(exp.files[f]))) {
      if (!keep(m)) continue;
      byTs.set(m.ts, m);
      const row = toRow(m, exp, channel, byTs, slackToUser);
      if (row) batch.push(row);
      if (batch.length >= 500) await flush();
    }
  }
  await flush();
  return { channelId, imported };
}

function keep(m) {
  return m.type === 'message' && !SKIP_SUBTYPES.has(m.subtype) && (m.text || m.files?.length);
}

function toRow(m, exp, channel, byTs, slackToUser) {
  const author = exp.users.get(m.user) || { name: m.user_profile?.real_name || m.username || 'Unknown', avatar: m.user_profile?.image_72 || null };
  const attachments = (m.files || [])
    .filter((f) => f.name || f.title)
    .map((f) => ({ title: f.name || f.title, url: f.permalink || f.url_private || '#', mimeType: f.mimetype || null, size: f.size || null }));

  let body = formatText(m.text || '', exp).trim();
  if (!body && attachments.length) body = 'Shared attachment';
  if (!body) return null;

  const parent = m.thread_ts && m.thread_ts !== m.ts ? byTs.get(m.thread_ts) : null;
  return {
    userId: slackToUser(m.user),
    body: body.slice(0, 16000),
    externalId: `${channel.id}:${m.ts}`,
    createdAt: toMysqlDate(Number(m.ts) * 1000),
    editedAt: m.edited?.ts ? toMysqlDate(Number(m.edited.ts) * 1000) : null,
    metadata: {
      source: SOURCE,
      author: { id: m.user || m.bot_id || null, name: author.name, avatar: author.avatar, bot: Boolean(m.bot_id) },
      ...(parent && {
        replyTo: {
          author: exp.users.get(parent.user)?.name || 'Unknown',
          excerpt: formatText(parent.text || '', exp).slice(0, 140),
        },
      }),
    },
    attachments,
  };
}

// Slack markup: <@U123>, <#C123|name>, <https://x|label>, <!here>, and HTML entities.
function formatText(text, exp) {
  return text
    .replace(/<@([A-Z0-9]+)(?:\|[^>]*)?>/g, (_, id) => `@${exp.users.get(id)?.name || 'someone'}`)
    .replace(/<#([A-Z0-9]+)(?:\|([^>]*))?>/g, (_, id, name) => `#${name || exp.channelNames.get(id) || 'channel'}`)
    .replace(/<!(here|channel|everyone)(?:\|[^>]*)?>/g, '@$1')
    .replace(/<!subteam\^[A-Z0-9]+\|([^>]+)>/g, '$1')
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2 ($1)')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/<mailto:([^|>]+)\|[^>]+>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
