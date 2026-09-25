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
    `SELECT u.*, t.id AS token_id, t.name AS token_name FROM api_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND (t.expires_at IS NULL OR t.expires_at > NOW())`,
    [hash(m[1])]
  );
  if (!row) return null;
  query('UPDATE api_tokens SET last_used_at = NOW() WHERE id = ?', [row.token_id]).catch(() => {});
  return row;
}

// Personal keys, plus connected apps (OAuth access tokens).
export function listApiTokens(userId) {
  return query(
    `SELECT id, name, token_prefix, last_used_at, created_at, oauth_client_id FROM api_tokens
     WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY id DESC`,
    [userId]
  );
}

// Revoking an app's key also disconnects the app (its refresh tokens and other access tokens).
export async function revokeApiToken(userId, id) {
  const row = await queryOne('SELECT oauth_client_id FROM api_tokens WHERE user_id = ? AND id = ?', [userId, id]);
  if (row?.oauth_client_id) {
    await query('DELETE FROM api_tokens WHERE user_id = ? AND oauth_client_id = ?', [userId, row.oauth_client_id]);
    await query('DELETE FROM oauth_refresh_tokens WHERE user_id = ? AND client_id = ?', [userId, row.oauth_client_id]);
    return;
  }
  await query('DELETE FROM api_tokens WHERE user_id = ? AND id = ?', [userId, id]);
}
