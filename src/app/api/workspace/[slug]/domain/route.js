import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db.js';
import { withWorkspaceAdmin, audit } from '@/lib/workspace.js';
import { normalizeDomain, isValidDomain, isPlatformHost } from '@/lib/hosts.js';
import { isVercelConfigured, addDomain, removeDomain, domainStatus, verifyDomain } from '@/lib/vercel-domains.js';

// Current custom domain and whether it's live yet (?check=1 asks Vercel to re-verify now).
export const GET = withWorkspaceAdmin(async (request, { tenant }) => {
  const domain = tenant.custom_domain;
  if (!domain) return NextResponse.json({ domain: null, automatic: isVercelConfigured() });
  if (!isVercelConfigured()) return NextResponse.json({ domain, automatic: false });
  const status = request.nextUrl.searchParams.get('check') ? await verifyDomain(domain) : await domainStatus(domain);
  return NextResponse.json({ domain, automatic: true, ...status });
});

// Set or change the domain.
export const PUT = withWorkspaceAdmin(async (request, { user, tenant }) => {
  const b = await request.json().catch(() => ({}));
  const domain = normalizeDomain(b.domain);
  if (!isValidDomain(domain)) return NextResponse.json({ error: 'Enter a domain like team.example.com' }, { status: 400 });
  if (isPlatformHost(domain) || domain.endsWith('.vercel.app')) {
    return NextResponse.json({ error: 'That domain is reserved' }, { status: 400 });
  }
  const taken = await queryOne('SELECT id FROM tenants WHERE custom_domain = ? AND id <> ?', [domain, tenant.id]);
  if (taken) return NextResponse.json({ error: 'Another workspace already uses that domain' }, { status: 409 });

  if (isVercelConfigured()) {
    await addDomain(domain);
    if (tenant.custom_domain && tenant.custom_domain !== domain) await removeDomain(tenant.custom_domain).catch(() => {});
  }
  await query('UPDATE tenants SET custom_domain = ? WHERE id = ?', [domain, tenant.id]);
  await audit(tenant.id, user.id, 'domain.set', domain, { previous: tenant.custom_domain });

  const status = isVercelConfigured() ? await domainStatus(domain) : {};
  return NextResponse.json({ domain, automatic: isVercelConfigured(), ...status });
});

export const DELETE = withWorkspaceAdmin(async (request, { user, tenant }) => {
  if (!tenant.custom_domain) return NextResponse.json({ ok: true });
  if (isVercelConfigured()) await removeDomain(tenant.custom_domain);
  await query('UPDATE tenants SET custom_domain = NULL WHERE id = ?', [tenant.id]);
  await audit(tenant.id, user.id, 'domain.remove', tenant.custom_domain);
  return NextResponse.json({ ok: true });
});
