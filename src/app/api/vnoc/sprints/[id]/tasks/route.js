import { NextResponse } from 'next/server';
import { withVnoc } from '@/lib/vnoc-route.js';
import { resolveDomain, listSprintTasks, taskUrl } from '@/lib/vnoc.js';

export const GET = withVnoc(async (request, { params, access }) => {
  const { id } = await params;
  const domain = await resolveDomain(access, request.nextUrl.searchParams.get('domain'));
  if (!domain) return NextResponse.json({ error: "Domain not found, or you don't have access to it." }, { status: 403 });
  const tasks = await listSprintTasks(domain.domain_name, Number(id));
  return NextResponse.json({ tasks: tasks.map((t) => ({ ...t, url: taskUrl(t.task_id) })) });
});
