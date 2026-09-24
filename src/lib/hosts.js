// White-label workspace hosts, configured as TENANT_HOSTS="team.vnoc.com=vnoc,chat.example.com=example".
// Safe to import from middleware (no Node-only APIs).
export function tenantSlugForHost(host) {
  const clean = (host || '').split(':')[0].toLowerCase();
  for (const entry of (process.env.TENANT_HOSTS || '').split(',')) {
    const [h, slug] = entry.split('=').map(s => s?.trim().toLowerCase());
    if (h && slug && h === clean) return slug;
  }
  return null;
}
