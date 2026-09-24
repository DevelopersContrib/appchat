// Which workspace a request's host belongs to.
//  - Platform hosts (appchat.com, previews, localhost) aren't workspace hosts.
//  - TENANT_HOSTS env ("team.vnoc.com=vnoc,...") is a static override.
//  - Otherwise tenants.custom_domain in the database (set in Workspace settings → Domain).
// Safe to import from middleware (no Node-only APIs).
const PLATFORM_HOSTS = ['appchat.com', 'www.appchat.com', 'localhost', '127.0.0.1'];

export function cleanHost(host) {
  return (host || '').split(':')[0].toLowerCase().replace(/\.$/, '');
}

export function isPlatformHost(host) {
  const h = cleanHost(host);
  return PLATFORM_HOSTS.includes(h) || h.endsWith('.vercel.app') || /^\d+\.\d+\.\d+\.\d+$/.test(h);
}

export function tenantSlugForHost(host) {
  const clean = cleanHost(host);
  for (const entry of (process.env.TENANT_HOSTS || '').split(',')) {
    const [h, slug] = entry.split('=').map(s => s?.trim().toLowerCase());
    if (h && slug && h === clean) return slug;
  }
  return null;
}

export function normalizeDomain(input) {
  return cleanHost(String(input || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, ''));
}

export function isValidDomain(domain) {
  return /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
}
