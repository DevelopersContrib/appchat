import 'server-only';
import { getClient } from './oauth.js';

/** Validates an /oauth/authorize request. Returns { error } (show a page, never redirect) or the request. */
export async function parseAuthRequest(p) {
  const client = await getClient(p.client_id);
  if (!client) return { error: 'This app isn’t registered with AppChat. Try connecting again from the app.' };
  const redirectUri = String(p.redirect_uri || '');
  if (!client.redirect_uris.includes(redirectUri)) return { error: 'The app sent a return address AppChat doesn’t recognise.' };
  if (p.response_type !== 'code') return { error: 'Unsupported response type.', redirectError: 'unsupported_response_type', client, redirectUri, state: p.state };
  if (!p.code_challenge || (p.code_challenge_method || 'S256') !== 'S256') {
    return { error: 'The app must use PKCE (S256).', redirectError: 'invalid_request', client, redirectUri, state: p.state };
  }
  return { client, redirectUri, state: p.state ? String(p.state) : '', codeChallenge: String(p.code_challenge) };
}

export function withParams(uri, params) {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}
