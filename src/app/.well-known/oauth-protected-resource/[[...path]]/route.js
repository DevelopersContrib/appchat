import { json, preflight } from '@/lib/oauth-http.js';
import { issuerFor } from '@/lib/oauth.js';

// RFC 9728: tells MCP clients which authorization server protects /api/mcp.
export function GET(request) {
  const issuer = issuerFor(request);
  return json(
    { resource: `${issuer}/api/mcp`, authorization_servers: [issuer], bearer_methods_supported: ['header'], scopes_supported: ['appchat'], resource_name: 'AppChat' },
    200,
    { 'Cache-Control': 'public, max-age=3600' }
  );
}
export const OPTIONS = preflight;
