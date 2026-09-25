import 'server-only';
import { createHash, randomBytes } from 'crypto';
import { query, queryOne, insert } from './db.js';

// OAuth 2.1 authorization server for AppChat's MCP endpoint (claude.ai / ChatGPT custom connectors).
// Public clients only (PKCE S256, no client secrets), dynamic client registration.
export const ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 3600;
const REFRESH_TOKEN_TTL_DAYS = 60;
const CODE_TTL_SECONDS = 600;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function issuerFor(request) {
  return request.nextUrl.origin.replace(/^http:\/\/(?!localhost|127\.0\.0\.1)/, 'https://');
}

export function authServerMetadata(issuer) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['appchat'],
  };
}

export function validRedirectUri(uri) {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    return u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname));
  } catch {
    return false;
  }
}

export async function registerClient({ client_name, redirect_uris }) {
  const uris = (Array.isArray(redirect_uris) ? redirect_uris : []).map(String).filter(validRedirectUri).slice(0, 10);
  if (!uris.length) throw Object.assign(new Error('redirect_uris must include at least one https (or localhost) URL'), { oauth: 'invalid_redirect_uri' });
  const client = { client_id: `appchat_${b64url(randomBytes(18))}`, client_name: String(client_name || 'AI assistant').slice(0, 200), redirect_uris: uris };
  await insert('INSERT INTO oauth_clients (client_id, client_name, redirect_uris) VALUES (?, ?, ?)', [client.client_id, client.client_name, JSON.stringify(uris)]);
  return client;
}

export async function getClient(clientId) {
  const row = await queryOne('SELECT * FROM oauth_clients WHERE client_id = ?', [String(clientId || '')]);
  if (!row) return null;
  return { ...row, redirect_uris: typeof row.redirect_uris === 'string' ? JSON.parse(row.redirect_uris) : row.redirect_uris };
}

export async function createAuthCode({ clientId, userId, redirectUri, codeChallenge }) {
  const code = b64url(randomBytes(32));
  await insert(
    `INSERT INTO oauth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, expires_at)
     VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL ${CODE_TTL_SECONDS} SECOND)`,
    [sha256(code), clientId, userId, redirectUri, codeChallenge]
  );
  return code;
}

async function issueTokens(client, userId) {
  const access = `appc_${b64url(randomBytes(30))}`;
  const refresh = `appr_${b64url(randomBytes(30))}`;
  await insert(
    `INSERT INTO api_tokens (user_id, name, token_hash, token_prefix, expires_at, oauth_client_id)
     VALUES (?, ?, ?, ?, NOW() + INTERVAL ${ACCESS_TOKEN_TTL_SECONDS} SECOND, ?)`,
    [userId, client.client_name, sha256(access), access.slice(0, 12), client.client_id]
  );
  await insert(
    `INSERT INTO oauth_refresh_tokens (token_hash, client_id, user_id, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL ${REFRESH_TOKEN_TTL_DAYS} DAY)`,
    [sha256(refresh), client.client_id, userId]
  );
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TOKEN_TTL_SECONDS, refresh_token: refresh, scope: 'appchat' };
}

const oauthError = (code, description) => Object.assign(new Error(description), { oauth: code });

export async function exchangeCode({ code, redirect_uri, client_id, code_verifier }) {
  const client = await getClient(client_id);
  if (!client) throw oauthError('invalid_client', 'Unknown client');
  // Expiry is checked in SQL so app/database time zones can't disagree.
  const row = await queryOne('SELECT *, expires_at > NOW() AS live FROM oauth_codes WHERE code_hash = ?', [sha256(String(code || ''))]);
  // Codes are single use: delete before checking so a replay can never succeed.
  if (row) await query('DELETE FROM oauth_codes WHERE code_hash = ?', [row.code_hash]);
  if (!row || !row.live) throw oauthError('invalid_grant', 'Code is invalid or expired');
  if (row.client_id !== client.client_id || row.redirect_uri !== redirect_uri) throw oauthError('invalid_grant', 'Code was issued to a different client or redirect_uri');
  const challenge = b64url(createHash('sha256').update(String(code_verifier || '')).digest());
  if (!code_verifier || challenge !== row.code_challenge) throw oauthError('invalid_grant', 'PKCE verification failed');
  return issueTokens(client, row.user_id);
}

export async function refresh({ refresh_token, client_id }) {
  const client = await getClient(client_id);
  if (!client) throw oauthError('invalid_client', 'Unknown client');
  const row = await queryOne('SELECT *, expires_at > NOW() AS live FROM oauth_refresh_tokens WHERE token_hash = ?', [sha256(String(refresh_token || ''))]);
  if (row) await query('DELETE FROM oauth_refresh_tokens WHERE token_hash = ?', [row.token_hash]); // rotate
  if (!row || row.client_id !== client.client_id || !row.live) {
    throw oauthError('invalid_grant', 'Refresh token is invalid or expired');
  }
  return issueTokens(client, row.user_id);
}

/** Revoke an access or refresh token (RFC 7009 — always succeeds). */
export async function revokeToken(token) {
  const h = sha256(String(token || ''));
  await query('DELETE FROM api_tokens WHERE token_hash = ?', [h]);
  await query('DELETE FROM oauth_refresh_tokens WHERE token_hash = ?', [h]);
}

export { oauthError };
