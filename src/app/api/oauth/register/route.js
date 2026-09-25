import { json, preflight } from '@/lib/oauth-http.js';
import { registerClient } from '@/lib/oauth.js';
import { rateLimit, getClientIp } from '@/lib/security.js';

// RFC 7591 dynamic client registration (public clients, PKCE).
export async function POST(request) {
  if (!rateLimit(`oauth-register:${getClientIp(request)}`, 20, 3600000)) {
    return json({ error: 'slow_down', error_description: 'Too many registrations' }, 429);
  }
  const body = await request.json().catch(() => ({}));
  try {
    const c = await registerClient(body);
    return json({
      client_id: c.client_id,
      client_name: c.client_name,
      redirect_uris: c.redirect_uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_id_issued_at: Math.floor(Date.now() / 1000),
    }, 201);
  } catch (err) {
    return json({ error: err.oauth || 'invalid_client_metadata', error_description: err.message }, 400);
  }
}
export const OPTIONS = preflight;
