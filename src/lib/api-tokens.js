import 'server-only';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import { query, queryOne, insert } from './db.js';

const hash = (t) => createHash('sha256').update(t).digest('hex');

/** Creates a key like "appc_…" (shown once) and stores only its hash. */
export async function createApiToken(userId, name) {
  const token = `appc_${nanoid(40)}`;
  await insert('INSERT INTO api_tokens (user_id, name, token_hash, token_prefix) VALUES (?, ?, ?, ?)', [
    userId, String(name || 'AI assistant').slice(0, 100), hash(token), token.slice(0, 12),
  ]);
  return token;
}

/** The user behind an "Authorization: Bearer appc_…" header, or null. */
export async function userFromBearer(request) {
  const m = /^Bearer\s+(appc_[A-Za-z0-9_-]{20,})$/.exec(request.headers.get('authorization') || '');
  if (!m) return null;
  const row = await queryOne(
    `SELECT u.*, t.id AS token_id, t.name AS token_name FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?`,
    [hash(m[1])]
  );
  if (!row) return null;
  query('UPDATE api_tokens SET last_used_at = NOW() WHERE id = ?', [row.token_id]).catch(() => {});
  return row;
}

export function listApiTokens(userId) {
  return query('SELECT id, name, token_prefix, last_used_at, created_at FROM api_tokens WHERE user_id = ? ORDER BY id DESC', [userId]);
}

export function revokeApiToken(userId, id) {
  return query('DELETE FROM api_tokens WHERE user_id = ? AND id = ?', [userId, id]);
}
