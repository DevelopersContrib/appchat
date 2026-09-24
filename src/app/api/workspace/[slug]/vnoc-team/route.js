import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { withWorkspaceAdmin } from '@/lib/workspace.js';
import { getVnocAccess, resolveDomain, getDomainTeam, searchDomains } from '@/lib/vnoc.js';

// Preview a VNOC website's team before importing (?domain=), or search domains (?q=).
export const GET = withWorkspaceAdmin(async (request, { user, tenant }) => {
  const access = await getVnocAccess(user);
  const sp = request.nextUrl.searchParams;
  if (sp.get('q') !== null) {
    const q = sp.get('q') || '';
    return NextResponse.json({ domains: q.trim().length >= 2 ? await searchDomains(access, q, 10) : [] });
  }
  const domain = await resolveDomain(access, sp.get('domain'));
  if (!domain) return NextResponse.json({ error: "That website isn't in VNOC, or you don't have access to it" }, { status: 404 });
  const team = await getDomainTeam(domain.domain_id);
  const emails = team.map((p) => p.email);
  const members = emails.length
    ? await query(
        `SELECT LOWER(u.email) AS email FROM tenant_members tm JOIN users u ON u.id = tm.user_id
         WHERE tm.tenant_id = ? AND LOWER(u.email) IN (?)`,
        [tenant.id, emails]
      )
    : [];
  const inWorkspace = new Set(members.map((m) => m.email));
  return NextResponse.json({
    domain: domain.domain_name,
    team: team.map((p) => ({ ...p, alreadyMember: inWorkspace.has(p.email) })),
  });
});
