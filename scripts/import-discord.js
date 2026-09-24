// Import Discord channel history into a workspace from the command line.
// (Workspace admins can also do this in the app: sidebar → Import from Discord.)
//
//   DISCORD_BOT_TOKEN=... node --env-file=.env.local scripts/import-discord.js --guild <server id> --tenant <workspace slug>
//
// Options:
//   --guild <id>        Discord server ID (required). Right-click the server → Copy Server ID.
//   --channels a,b      Only these Discord channel IDs (default: every text/announcement channel the bot can read).
//   --tenant <slug>     Workspace to import into (required).
//   --map users.json    {"discord username or user id": "person@company.com"} so messages show as that member.
//   --dry-run           Show what would be imported without writing anything.
//
// Safe to re-run: each channel picks up after the last message already imported.
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';
import { loadGuild, importChannelStep } from '../src/lib/discord-import.js';

const opts = parseArgs(process.argv.slice(2));
if (!process.env.DISCORD_BOT_TOKEN) fail('Set DISCORD_BOT_TOKEN (see docs/DISCORD_IMPORT.md).');
if (!opts.guild) fail('Pass --guild <server id>.');
if (!opts.tenant) fail('Pass --tenant <workspace slug>.');

const userMap = opts.map ? JSON.parse(readFileSync(opts.map, 'utf8')) : {};
const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, charset: 'utf8mb4' });

const [[tenant]] = await db.query('SELECT id, name FROM tenants WHERE slug = ?', [opts.tenant]);
if (!tenant) fail(`No workspace with slug "${opts.tenant}".`);

const guild = await loadGuild(opts.guild);
const emailToUserId = await loadMappedUsers();
const channels = opts.channels ? guild.channels.filter((c) => opts.channels.includes(c.id)) : guild.channels;

console.log(`Importing from Discord server "${guild.name}" into ${tenant.name}${opts.dryRun ? ' (dry run)' : ''}`);

let grandTotal = 0;
for (const dc of channels) {
  let count = 0;
  let channelId = null;
  try {
    for (;;) {
      const step = await importChannelStep(db, { tenantId: tenant.id, guild, dc, userMap, emailToUserId, dryRun: opts.dryRun, maxPages: 20 });
      channelId = step.channelId;
      count += step.imported;
      process.stdout.write(`\r  #${dc.name}: ${count} messages`);
      if (step.done || opts.dryRun) break;
    }
    if (!opts.dryRun && count > 0) {
      await db.query('INSERT INTO messages (channel_id, body, type) VALUES (?, ?, ?)', [channelId, `${count} messages imported from Discord #${dc.name}`, 'system']);
    }
    process.stdout.write('\n');
    grandTotal += count;
  } catch (err) {
    // Usually a channel the bot can't see (missing View Channel / Read Message History).
    console.warn(`\n  #${dc.name}: skipped (${err.message})`);
  }
}

console.log(`Done. ${grandTotal} messages ${opts.dryRun ? 'would be ' : ''}imported.`);
await db.end();

async function loadMappedUsers() {
  const emails = [...new Set(Object.values(userMap).map((e) => String(e).toLowerCase()))];
  if (!emails.length) return new Map();
  const [rows] = await db.query('SELECT id, email FROM users WHERE LOWER(email) IN (?)', [emails]);
  const found = new Map(rows.map((r) => [r.email.toLowerCase(), r.id]));
  const missing = emails.filter((e) => !found.has(e));
  if (missing.length) console.warn(`Not yet members (their messages will show their Discord name): ${missing.join(', ')}`);
  return found;
}

function parseArgs(argv) {
  const o = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--guild') o.guild = argv[++i];
    else if (a === '--channels') o.channels = argv[++i].split(',').map((s) => s.trim());
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
