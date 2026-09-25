import { json, preflight, readBody } from '@/lib/oauth-http.js';
import { revokeToken } from '@/lib/oauth.js';

export async function POST(request) {
  const b = await readBody(request);
  await revokeToken(b.token);
  return json({});
}
export const OPTIONS = preflight;
