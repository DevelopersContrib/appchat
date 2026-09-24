// Import Discord channel history into a workspace.
//
//   DISCORD_BOT_TOKEN=... node --env-file=.env.local scripts/import-discord.js --guild <server id> --tenant <workspace slug>
//
// Options:
//   --guild <id>        Discord server ID (required). Right-click the server → Copy Server ID.
//   --channels a,b      Only these Discord channel IDs (default: every text/announcement channel the bot can read).
//   --tenant <slug>     Workspace to import into (required).
//   --map users.json    {"discord username or user id": "person@company.com"} so messages show as that team member.
//   --dry-run           Show what would be imported without writing anything.
//
// Safe to re-run: each channel picks up after the last message already imported.
// Discord channels are matched to existing workspace channels by name, otherwise created.
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

const API = 'https://discord.com/api/v10';
const SOURCE = 'discord';
const TEXT_CHANNEL_TYPES = new Set([0, 5]); // text, announcement
const CONTENT_MESSAGE_TYPES = new Set([0, 19, 20, 21]); // default, reply, slash command, thread starter

const opts = parseArgs(process.argv.slice(2));
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) fail('Set DISCORD_BOT_TOKEN (see docs/DISCORD_IMPORT.md).');
if (!opts.guild) fail('Pass --guild <server id>.');
if (!opts.tenant) fail('Pass --tenant <workspace slug>.');

const userMap = opts.map ? JSON.parse(readFileSync(opts.map, 'utf8')) : {};
const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, charset: 'utf8mb4' });

const [[tenant]] = await db.query('SELECT id, name FROM tenants WHERE slug = ?', [opts.tenant]);
if (!tenant) fail(`No workspace with slug "${opts.tenant}".`);

const guild = await discord(`/guilds/${opts.guild}`);
const allChannels = await discord(`/guilds/${opts.guild}/channels`);
const roles = await discord(`/guilds/${opts.guild}/roles`);
const channelNames = new Map(allChannels.map(c => [c.id, c.name]));
const roleNames = new Map(roles.map(r => [r.id, r.name]));
const emailToUserId = await loadMappedUsers();

let channels = allChannels
  .filter(c => TEXT_CHANNEL_TYPES.has(c.type))
  .sort((a, b) => a.position - b.position);
if (opts.channels) channels = channels.filter(c => opts.channels.includes(c.id));

console.log(`Importing from Discord server "${guild.name}" into ${tenant.name}${opts.dryRun ? ' (dry run)' : ''}`);

let grandTotal = 0;
for (const dc of channels) {
  try {
    grandTotal += await importChannel(dc);
  } catch (err) {
    // Usually a channel the bot can't see (missing View Channel / Read Message History).
    console.warn(`  #${dc.name}: skipped (${err.message})`);
  }
}

console.log(`Done. ${grandTotal} messages ${opts.dryRun ? 'would be' : ''} imported.`);
await db.end();

async function importChannel(dc) {
  const channelId = opts.dryRun ? null : await ensureChannel(dc);
  let after = channelId ? await lastImportedId(channelId) : '0';
  const resuming = after !== '0';
  let count = 0;

  for (;;) {
    const page = await discord(`/channels/${dc.id}/messages?limit=100&after=${after}`);
    if (!page.length) break;
    page.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
    after = page[page.length - 1].id;

    const rows = page.map(toRow).filter(Boolean);
    count += opts.dryRun ? rows.length : rows.length && await insertPage(channelId, rows);
    process.stdout.write(`\r  #${dc.name}: ${count} messages`);
  }

  if (!opts.dryRun && count > 0) {
    await db.query(
      'INSERT INTO messages (channel_id, body, type) VALUES (?, ?, ?)',
      [channelId, `${count} ${resuming ? 'new ' : ''}messages imported from Discord #${dc.name}`, 'system']
    );
  }
  process.stdout.write(`\r  #${dc.name}: ${count} messages${resuming ? ' (new since last import)' : ''}\n`);
  return count;
}

async function ensureChannel(dc) {
  const [[linked]] = await db.query(
    'SELECT id FROM channels WHERE tenant_id = ? AND source = ? AND external_id = ?',
    [tenant.id, SOURCE, dc.id]
  );
  let channelId = linked?.id;

  if (!channelId) {
    const [[byName]] = await db.query(
      'SELECT id FROM channels WHERE tenant_id = ? AND name = ? AND source IS NULL AND is_dm = 0 LIMIT 1',
      [tenant.id, dc.name]
    );
    if (byName) {
      channelId = byName.id;
      await db.query('UPDATE channels SET source = ?, external_id = ? WHERE id = ?', [SOURCE, dc.id, channelId]);
    } else {
      const [res] = await db.query(
        'INSERT INTO channels (tenant_id, name, description, source, external_id) VALUES (?, ?, ?, ?, ?)',
        [tenant.id, dc.name, (dc.topic || '').slice(0, 500), SOURCE, dc.id]
      );
      channelId = res.insertId;
    }
  }

  await db.query(
    `INSERT IGNORE INTO channel_members (channel_id, user_id)
     SELECT ?, user_id FROM tenant_members WHERE tenant_id = ?`,
    [channelId, tenant.id]
  );
  return channelId;
}

async function lastImportedId(channelId) {
  const [[row]] = await db.query(
    `SELECT external_id FROM messages WHERE channel_id = ? AND source = ?
     ORDER BY CAST(external_id AS UNSIGNED) DESC LIMIT 1`,
    [channelId, SOURCE]
  );
  return row?.external_id || '0';
}

function toRow(msg) {
  if (!CONTENT_MESSAGE_TYPES.has(msg.type)) return null;

  const parts = [formatContent(msg.content || '', msg)];
  for (const e of msg.embeds || []) {
    if (e.type === 'rich' || e.type === 'article') {
      parts.push([e.title, e.description].filter(Boolean).join('\n'));
    }
  }
  for (const s of msg.sticker_items || []) parts.push(`[sticker: ${s.name}]`);
  const attachments = (msg.attachments || []).map(a => ({
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
  const userId = mappedEmail ? emailToUserId.get(mappedEmail.toLowerCase()) || null : null;
  const ref = msg.referenced_message;

  return {
    userId,
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
          excerpt: formatContent(ref.content || '', ref).slice(0, 140),
        },
      }),
    },
    attachments,
  };
}

async function insertPage(channelId, rows) {
  await db.beginTransaction();
  try {
    const [inserted] = await db.query(
      `INSERT IGNORE INTO messages (channel_id, user_id, body, type, metadata, source, external_id, created_at, edited_at)
       VALUES ?`,
      [rows.map(r => [channelId, r.userId, r.body, 'text', JSON.stringify(r.metadata), SOURCE, r.externalId, r.createdAt, r.editedAt])]
    );

    const withFiles = rows.filter(r => r.attachments.length);
    if (withFiles.length) {
      const [ids] = await db.query(
        'SELECT id, external_id FROM messages WHERE channel_id = ? AND source = ? AND external_id IN (?)',
        [channelId, SOURCE, withFiles.map(r => r.externalId)]
      );
      const idByExternal = new Map(ids.map(r => [r.external_id, r.id]));
      const attachmentRows = withFiles.flatMap(r =>
        r.attachments.map(a => [idByExternal.get(r.externalId), 'file', a.title.slice(0, 500), a.url, a.mimeType, a.size])
      );
      await db.query(
        'INSERT INTO message_attachments (message_id, type, title, url, mime_type, size_bytes) VALUES ?',
        [attachmentRows]
      );
    }
    await db.commit();
    return inserted.affectedRows;
  } catch (err) {
    await db.rollback();
    throw err;
  }
}

// Turn Discord markup (<@id>, <#id>, <:emoji:id>, <t:unix>) into plain readable text.
function formatContent(text, msg) {
  const mentionNames = new Map((msg.mentions || []).map(u => [u.id, u.global_name || u.username]));
  return text
    .replace(/<@!?(\d+)>/g, (_, id) => `@${mentionNames.get(id) || 'someone'}`)
    .replace(/<@&(\d+)>/g, (_, id) => `@${roleNames.get(id) || 'role'}`)
    .replace(/<#(\d+)>/g, (_, id) => `#${channelNames.get(id) || 'channel'}`)
    .replace(/<a?:(\w+):\d+>/g, ':$1:')
    .replace(/<t:(\d+)(?::\w)?>/g, (_, s) => new Date(Number(s) * 1000).toUTCString());
}

async function loadMappedUsers() {
  const emails = [...new Set(Object.values(userMap).map(e => String(e).toLowerCase()))];
  if (!emails.length) return new Map();
  const [rows] = await db.query('SELECT id, email FROM users WHERE LOWER(email) IN (?)', [emails]);
  const found = new Map(rows.map(r => [r.email.toLowerCase(), r.id]));
  const missing = emails.filter(e => !found.has(e));
  if (missing.length) console.warn(`Not yet team members (their messages will show their Discord name): ${missing.join(', ')}`);
  return found;
}

async function discord(path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(API + path, { headers: { Authorization: `Bot ${token}` } });
    if (res.status === 429) {
      const { retry_after = 1 } = await res.json().catch(() => ({}));
      await sleep(retry_after * 1000 + 250);
      continue;
    }
    if (!res.ok) throw new Error(`Discord ${res.status} on ${path.split('?')[0]}`);
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      await sleep(Number(res.headers.get('x-ratelimit-reset-after') || 1) * 1000);
    }
    return res.json();
  }
  throw new Error(`Discord kept rate-limiting ${path}`);
}

function toMysql(iso) {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseArgs(argv) {
  const o = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--guild') o.guild = argv[++i];
    else if (a === '--channels') o.channels = argv[++i].split(',').map(s => s.trim());
    else if (a === '--tenant') o.tenant = argv[++i];
    else if (a === '--map') o.map = argv[++i];
    else if (a === '--dry-run') o.dryRun = true;
    else fail(`Unknown option ${a}`);
  }
  return o;
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
