import { json, preflight } from '@/lib/oauth-http.js';
import { authServerMetadata, issuerFor } from '@/lib/oauth.js';

export const GET = (request) => json(authServerMetadata(issuerFor(request)), 200, { 'Cache-Control': 'public, max-age=3600' });
export const OPTIONS = preflight;
