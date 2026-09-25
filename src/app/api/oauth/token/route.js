import { json, preflight, readBody } from '@/lib/oauth-http.js';
import { exchangeCode, refresh } from '@/lib/oauth.js';
import { rateLimit, getClientIp } from '@/lib/security.js';

export async function POST(request) {
  if (!rateLimit(`oauth-token:${getClientIp(request)}`, 60, 60000)) return json({ error: 'slow_down' }, 429);
  const b = await readBody(request);
  try {
    if (b.grant_type === 'authorization_code') return json(await exchangeCode(b));
    if (b.grant_type === 'refresh_token') return json(await refresh(b));
    return json({ error: 'unsupported_grant_type' }, 400);
  } catch (err) {
    return json({ error: err.oauth || 'invalid_request', error_description: err.message }, err.oauth === 'invalid_client' ? 401 : 400);
  }
}
export const OPTIONS = preflight;
