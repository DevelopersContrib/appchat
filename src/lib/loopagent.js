import 'server-only';
import mysql from 'mysql2/promise';
import { query, insert, queryOne } from './db.js';

// LoopAgent (app.loopagent.com) daily debriefs, read from its database (LOOPAGENT_DATABASE_URL).
const LOOPAGENT_URL = 'https://app.loopagent.com';
let pool;
function la() {
  if (!process.env.LOOPAGENT_DATABASE_URL) throw new Error('LoopAgent is not connected');
  pool ??= mysql.createPool({ uri: process.env.LOOPAGENT_DATABASE_URL, connectionLimit: 2 });
  return pool;
}

export function isLoopAgentConfigured() {
  return Boolean(process.env.LOOPAGENT_DATABASE_URL);
}

/** Latest debrief, or the one for a given YYYY-MM-DD. */
export async function getDebrief(date) {
  const [rows] = await la().query(
    `SELECT DATE_FORMAT(briefing_date, '%Y-%m-%d') AS date, headline, summary, event_count
     FROM briefings ${date ? 'WHERE briefing_date = ?' : ''} ORDER BY briefing_date DESC LIMIT 1`,
    date ? [date] : []
  );
  const b = rows[0];
  if (!b) return null;
  // Summaries sometimes start with a repeated "# Headline" line.
  const summary = String(b.summary || '').replace(/^#\s.*\n+/, '').trim();
  return { date: b.date, headline: b.headline, summary, events: b.event_count, url: `${LOOPAGENT_URL}/debrief/${b.date}` };
}

/** Posts a debrief card into a channel unless that date was already posted there. Returns true if posted. */
export async function postDebrief(channelId, debrief) {
  const already = await queryOne(
    "SELECT id FROM messages WHERE channel_id = ? AND source = 'loopagent' AND external_id = ?",
    [channelId, debrief.date]
  );
  if (already) return false;
  await insert(
    'INSERT INTO messages (channel_id, user_id, body, type, metadata, source, external_id) VALUES (?, NULL, ?, ?, ?, ?, ?)',
    [
      channelId,
      `Daily debrief — ${debrief.headline}\n\n${debrief.summary}`.slice(0, 16000),
      'text',
      JSON.stringify({ card: { kind: 'debrief', ...debrief }, author: { id: 'loopagent', name: 'LoopAgent' } }),
      'loopagent',
      debrief.date,
    ]
  );
  return true;
}

/** Workspaces that chose a debrief channel (Settings → Tools). */
export async function debriefTargets() {
  const rows = await query(
    `SELECT t.id, t.slug, JSON_UNQUOTE(JSON_EXTRACT(t.settings, '$.debriefChannelId')) AS channel_id
     FROM tenants t WHERE JSON_EXTRACT(t.settings, '$.debriefChannelId') IS NOT NULL`
  );
  return rows.filter((r) => Number(r.channel_id));
}
