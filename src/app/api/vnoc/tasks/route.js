import { NextResponse } from 'next/server';
import { withVnoc, postCard } from '@/lib/vnoc-route.js';
import { resolveDomain, createTask, taskUrl } from '@/lib/vnoc.js';
import { rateLimit, sanitizeString } from '@/lib/security.js';

const PRIORITIES = ['urgent', 'high', 'normal', 'low'];

// Add a task to a sprint (or the domain's latest sprint) and post it into the channel.
export const POST = withVnoc(async (request, { user, access }) => {
  if (!rateLimit(`vnoc-write:${user.id}`, 20, 60000)) {
    return NextResponse.json({ error: 'Too many changes. Slow down.' }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const title = sanitizeString(body.title, 220);
  const domain = await resolveDomain(access, body.domain);
  if (!domain) return NextResponse.json({ error: "Domain not found, or you don't have access to it." }, { status: 403 });
  if (!title) return NextResponse.json({ error: 'Task title is required' }, { status: 400 });

  const { sprint, task } = await createTask({
    domain: domain.domain_name,
    sprintId: Number(body.sprintId) || null,
    title,
    description: sanitizeString(body.description, 4000),
    priority: PRIORITIES.includes(body.priority) ? body.priority : undefined,
    assignedTo: sanitizeString(body.assignee, 120),
    actorEmail: user.email,
  });

  const card = {
    kind: 'vnoc_task',
    taskId: task.task_id,
    title: task.title,
    domain: domain.domain_name,
    sprintId: sprint?.sprint_id,
    sprintTitle: sprint?.title,
    priority: body.priority || 'normal',
    url: taskUrl(task.task_id),
  };
  await postCard(body.channelId, user, `Added task "${task.title}" to ${domain.domain_name}`, card);
  return NextResponse.json({ task: card }, { status: 201 });
});
