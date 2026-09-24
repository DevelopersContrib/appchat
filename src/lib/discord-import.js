// Discord → AppChat import, shared by the admin screen (/api/admin/discord) and scripts/import-discord.js.
// Works in steps so a web request never runs long: each call imports up to `maxPages` × 100 messages
// for one channel and reports whether that channel is finished. Re-running resumes after the last
// imported message (tracked by messages.source/external_id).

import { ensureImportedChannel, insertImportedMessages, toMysqlDate } from './import-common.js';

const API = 'https://discord.com/api/v10';
export const SOURCE = 'discord';
const TEXT_CHANNEL_TYPES = new Set([0, 5]); // text, announcement
const CONTENT_MESSAGE_TYPES = new Set([0, 19, 20, 21]); // default, reply, slash command, thread starter

export function botInviteUrl() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  // View Channels + Read Message History
  return clientId ? `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot&permissions=66560` : null;
}

export async function discord(path, token = process.env.DISCORD_BOT_TOKEN) {
  if (!token) throw new Error('Discord import is not set up (missing DISCORD_BOT_TOKEN).');
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(API + path, { headers: { Authorization: `Bot ${token}` }, cache: 'no-store' });
    if (res.status === 429) {
      const { retry_after = 1 } = await res.json().catch(() => ({}));
      await sleep(retry_after * 1000 + 250);
      continue;
    }
    if (res.status === 403 || res.status === 404) {
      throw new Error("The AppChat bot can't see that server or channel. Add the bot to the server and give it Read Message History.");
    }
    if (!res.ok) throw new Error(`Discord error ${res.status}`);
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      await sleep(Number(res.headers.get('x-ratelimit-reset-after') || 1) * 1000);
    }
    return res.json();
  }
  throw new Error('Discord is rate-limiting requests. Try again in a minute.');
}

/** Servers the AppChat bot has been added to, so admins can pick one instead of typing an ID. */
export async function listBotGuilds(token) {
  const guilds = await discord('/users/@me/guilds?limit=200', token);
  return guilds.map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : null,
  }));
}

/** Server name, readable text channels, and lookup maps used to turn Discord markup into text. */
export async function loadGuild(guildId, token) {
  const [guild, channels, roles] = await Promise.all([
    discord(`/guilds/${guildId}`, token),
    discord(`/guilds/${guildId}/channels`, token),
    discord(`/guilds/${guildId}/roles`, token),
  ]);
  return {
    id: guild.id,
    name: guild.name,
    channels: channels.filter((c) => TEXT_CHANNEL_TYPES.has(c.type)).sort((a, b) => a.position - b.position),
    channelNames: new Map(channels.map((c) => [c.id, c.name])),
    roleNames: new Map(roles.map((r) => [r.id, r.name])),
  };
}

export function ensureChannel(db, tenantId, dc) {
  return ensureImportedChannel(db, { tenantId, source: SOURCE, externalId: dc.id, name: dc.name, topic: dc.topic });
}

export async function lastImportedId(db, channelId) {
  const [[row]] = await db.query(
    `SELECT external_id FROM messages WHERE channel_id = ? AND source = ?
     ORDER BY CAST(external_id AS UNSIGNED) DESC LIMIT 1`,
    [channelId, SOURCE]
  );
  return row?.external_id || '0';
}

/**
 * Imports up to maxPages × 100 messages of one Discord channel after the last imported one.
 * `db` is a single mysql2/promise connection (transactions need one connection).
 * Returns { channelId, imported, done }.
 */
export async function importChannelStep(db, { tenantId, guild, dc, token, maxPages = 5, userMap = {}, emailToUserId = new Map(), dryRun = false }) {
  const channelId = dryRun ? null : await ensureChannel(db, tenantId, dc);
  let after = channelId ? await lastImportedId(db, channelId) : '0';
  let imported = 0;

  for (let page = 0; page < maxPages; page++) {
    const batch = await discord(`/channels/${dc.id}/messages?limit=100&after=${after}`, token);
    if (!batch.length) return { channelId, imported, done: true };
    batch.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
    after = batch[batch.length - 1].id;

    const rows = batch.map((m) => toRow(m, guild, userMap, emailToUserId)).filter(Boolean);
    imported += dryRun ? rows.length : rows.length && (await insertPage(db, channelId, rows));
    if (batch.length < 100) return { channelId, imported, done: true };
  }
  return { channelId, imported, done: false };
}

function toRow(msg, guild, userMap, emailToUserId) {
  if (!CONTENT_MESSAGE_TYPES.has(msg.type)) return null;

  const parts = [formatContent(msg.content || '', msg, guild)];
  for (const e of msg.embeds || []) {
    if (e.type === 'rich' || e.type === 'article') parts.push([e.title, e.description].filter(Boolean).join('\n'));
  }
  for (const s of msg.sticker_items || []) parts.push(`[sticker: ${s.name}]`);
  const attachments = (msg.attachments || []).map((a) => ({
    title: a.filename,
    url: a.url,
    mimeType: a.content_type || null,
    size: a.size || null,
  }));

  let body = parts.filter(Boolean).join('\n').trim();
  if (!body && attachments.length) body = 'Shared attachment';
  if (!body) return null;

  const author = msg.author || {};
  const mappedEmail = userMap[author.id] || userMap[author.username];
  const userId = mappedEmail ? emailToUserId.get(String(mappedEmail).toLowerCase()) || null : null;
  const ref = msg.referenced_message;

  return {
    userId,
    // messages.body is TEXT (64KB); 4-byte chars × 16000 stays under it
    body: body.slice(0, 16000),
    externalId: msg.id,
    createdAt: toMysql(msg.timestamp),
    editedAt: msg.edited_timestamp ? toMysql(msg.edited_timestamp) : null,
    metadata: {
      source: SOURCE,
      author: {
        id: author.id,
        name: author.global_name || author.username || 'Unknown',
        avatar: author.avatar ? `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png?size=64` : null,
        bot: !!author.bot,
      },
      ...(ref && {
        replyTo: {
          author: ref.author?.global_name || ref.author?.username || 'Unknown',
          excerpt: formatContent(ref.content || '', ref, guild).slice(0, 140),
        },
      }),
    },
    attachments,
  };
}

function insertPage(db, channelId, rows) {
  return insertImportedMessages(db, channelId, SOURCE, rows);
}

// Turn Discord markup (<@id>, <#id>, <:emoji:id>, <t:unix>) into plain readable text.
function formatContent(text, msg, guild) {
  const mentionNames = new Map((msg.mentions || []).map((u) => [u.id, u.global_name || u.username]));
  return text
    .replace(/<@!?(\d+)>/g, (_, id) => `@${mentionNames.get(id) || 'someone'}`)
    .replace(/<@&(\d+)>/g, (_, id) => `@${guild.roleNames.get(id) || 'role'}`)
    .replace(/<#(\d+)>/g, (_, id) => `#${guild.channelNames.get(id) || 'channel'}`)
    .replace(/<a?:(\w+):\d+>/g, ':$1:')
    .replace(/<t:(\d+)(?::\w)?>/g, (_, s) => new Date(Number(s) * 1000).toUTCString());
}

const toMysql = toMysqlDate;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
