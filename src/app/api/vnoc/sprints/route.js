import { NextResponse } from 'next/server';
import { withVnoc, postCard } from '@/lib/vnoc-route.js';
import { searchSprints, resolveDomain, createSprint } from '@/lib/vnoc.js';
import { rateLimit, sanitizeString } from '@/lib/security.js';

// Search sprints across every domain the user can access (admins: all of VNOC).
export const GET = withVnoc(async (request, { access }) => {
  const sp = request.nextUrl.searchParams;
  const sprints = await searchSprints(access, { q: sp.get('q') || '', domain: sp.get('domain') || '', limit: sp.get('limit') });
  return NextResponse.json({ sprints, isAdmin: access.isAdmin });
});

export const POST = withVnoc(async (request, { user, access }) => {
  if (!rateLimit(`vnoc-write:${user.id}`, 20, 60000)) {
    return NextResponse.json({ error: 'Too many changes. Slow down.' }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const title = sanitizeString(body.title, 220);
  const domain = await resolveDomain(access, body.domain);
  if (!domain) return NextResponse.json({ error: "Domain not found, or you don't have access to it." }, { status: 403 });
  if (!title) return NextResponse.json({ error: 'Sprint title is required' }, { status: 400 });

  const created = await createSprint({
    domain: domain.domain_name,
    title,
    description: sanitizeString(body.description, 4000),
    goalDate: sanitizeString(body.goalDate, 20),
    actorEmail: user.email,
  });
  const sprintId = created.sprint_id ?? created.sprint?.sprint_id;
  await postCard(body.channelId, user, `Created sprint "${title}" for ${domain.domain_name}`, {
    kind: 'vnoc_sprint', sprintId, title, domain: domain.domain_name,
  });
  return NextResponse.json({ sprintId, title, domain: domain.domain_name }, { status: 201 });
});
