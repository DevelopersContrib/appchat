import 'server-only';
import { queryOne } from './db.js';
import { tenantSlugForHost, isPlatformHost, cleanHost } from './hosts.js';

/** Server-side: the workspace slug for a host (env override first, then tenants.custom_domain). */
export async function resolveTenantSlugForHost(host) {
  if (!host || isPlatformHost(host)) return null;
  const fromEnv = tenantSlugForHost(host);
  if (fromEnv) return fromEnv;
  const row = await queryOne('SELECT slug FROM tenants WHERE custom_domain = ?', [cleanHost(host)]).catch(() => null);
  return row?.slug || null;
}
