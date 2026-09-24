import { queryOne, query, insert } from './db.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
// Create calendar events with a Google Meet link (Start/Schedule Google Meet).
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

// `scopes` are added to whatever the person already granted (include_granted_scopes).
export function getGoogleAuthUrl(state, scopes = [DRIVE_SCOPE]) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/gdrive/callback`,
    response_type: 'code',
    scope: scopes.join(' '),
    include_granted_scopes: 'true',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeCode(code) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/gdrive/callback`,
    }),
  });
  return res.json();
}

export async function refreshAccessToken(refreshToken) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  return res.json();
}

export async function saveToken(userId, tokenData) {
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;

  const existing = await queryOne('SELECT id FROM user_google_tokens WHERE user_id = ?', [userId]);

  if (existing) {
    await query(
      `UPDATE user_google_tokens SET access_token = ?, refresh_token = COALESCE(?, refresh_token),
       token_type = ?, expires_at = ?, scope = ?, updated_at = NOW() WHERE user_id = ?`,
      [tokenData.access_token, tokenData.refresh_token || null, tokenData.token_type || 'Bearer', expiresAt, tokenData.scope || null, userId]
    );
  } else {
    await insert(
      'INSERT INTO user_google_tokens (user_id, access_token, refresh_token, token_type, expires_at, scope) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, tokenData.access_token, tokenData.refresh_token || null, tokenData.token_type || 'Bearer', expiresAt, tokenData.scope || null]
    );
  }
}

export async function getValidToken(userId) {
  const token = await queryOne('SELECT * FROM user_google_tokens WHERE user_id = ?', [userId]);
  if (!token) return null;

  if (token.expires_at && new Date(token.expires_at) < new Date()) {
    if (!token.refresh_token) return null;
    const refreshed = await refreshAccessToken(token.refresh_token);
    if (refreshed.error) return null;
    await saveToken(userId, refreshed);
    return refreshed.access_token;
  }

  return token.access_token;
}

export async function driveRequest(accessToken, path, params = {}) {
  const url = new URL(`${DRIVE_API}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return res.json();
}

export async function listFiles(accessToken, { folderId, query: q, pageSize = 20, pageToken } = {}) {
  const params = {
    pageSize,
    fields: 'nextPageToken, files(id, name, mimeType, size, thumbnailLink, webViewLink, iconLink, modifiedTime, owners)',
    orderBy: 'modifiedTime desc',
  };

  const queryParts = ["trashed = false"];
  if (folderId) queryParts.push(`'${folderId.replace(/'/g, "\\'")}' in parents`);
  if (q) queryParts.push(`name contains '${q.replace(/'/g, "\\'").slice(0, 100)}'`);
  params.q = queryParts.join(' and ');

  if (pageToken) params.pageToken = pageToken;

  return driveRequest(accessToken, '/files', params);
}

/** A usable access token for the user plus whether they've granted `scope`; null if not connected. */
export async function getTokenWithScope(userId, scope) {
  const row = await queryOne('SELECT scope FROM user_google_tokens WHERE user_id = ?', [userId]);
  if (!row) return null;
  const accessToken = await getValidToken(userId);
  if (!accessToken) return null;
  // Refreshes can return a narrower scope string; re-read what's stored after refresh.
  const fresh = await queryOne('SELECT scope FROM user_google_tokens WHERE user_id = ?', [userId]);
  const granted = `${fresh?.scope || ''} ${row.scope || ''}`;
  return { accessToken, hasScope: granted.split(/\s+/).includes(scope) };
}
