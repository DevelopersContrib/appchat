import 'server-only';

// Adds/checks/removes a workspace's custom domain on this app's Vercel project, so it gets HTTPS and routes here.
// Env: VERCEL_API_TOKEN (a Vercel access token with access to the team), VERCEL_PROJECT_ID, VERCEL_TEAM_ID.
const API = 'https://api.vercel.com';

export function isVercelConfigured() {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

async function vercel(path, { method = 'GET', body } = {}) {
  const url = new URL(API + path);
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set('teamId', process.env.VERCEL_TEAM_ID);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const project = () => `/projects/${process.env.VERCEL_PROJECT_ID}`;

export async function addDomain(domain) {
  const r = await vercel(`/v10${project()}/domains`, { method: 'POST', body: { name: domain } });
  // Already on this project is fine; anything else is a real error.
  if (!r.ok && r.data?.error?.code !== 'domain_already_in_use_by_project' && r.data?.error?.code !== 'domain_already_exists') {
    throw new Error(r.data?.error?.message || `Vercel couldn't add ${domain}`);
  }
}

export async function removeDomain(domain) {
  const r = await vercel(`/v9${project()}/domains/${encodeURIComponent(domain)}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw new Error(r.data?.error?.message || `Vercel couldn't remove ${domain}`);
}

/**
 * Status + the DNS records the domain owner must create.
 * Subdomains (team.vnoc.com): CNAME → Vercel. Apex domains (example.com): A → Vercel's IP.
 */
export async function domainStatus(domain) {
  const [info, config] = await Promise.all([
    vercel(`/v9${project()}/domains/${encodeURIComponent(domain)}`),
    vercel(`/v6/domains/${encodeURIComponent(domain)}/config`),
  ]);
  const isApex = domain.split('.').length === 2;
  const cname = config.data?.recommendedCNAME?.[0]?.value?.replace(/\.$/, '') || 'cname.vercel-dns.com';
  const aValue = config.data?.recommendedIPv4?.[0]?.value?.[0] || '76.76.21.21';
  const records = [
    isApex
      ? { type: 'A', name: '@', value: aValue }
      : { type: 'CNAME', name: domain.split('.').slice(0, -2).join('.'), value: cname },
    // Shown when Vercel needs proof of ownership (e.g. the domain is used by another Vercel account).
    ...(info.data?.verification || []).map((v) => ({ type: v.type, name: v.domain, value: v.value })),
  ];
  const verified = Boolean(info.data?.verified);
  const configured = config.ok && config.data?.misconfigured === false;
  return { verified, configured, live: verified && configured, records };
}

export async function verifyDomain(domain) {
  await vercel(`/v9${project()}/domains/${encodeURIComponent(domain)}/verify`, { method: 'POST' });
  return domainStatus(domain);
}
