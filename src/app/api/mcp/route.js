import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db.js';
import { userFromBearer } from '@/lib/api-tokens.js';
import { getUserTenants } from '@/lib/tenant.js';
import { hydrateMessages, MESSAGE_SELECT } from '@/lib/messages.js';
import { searchMessages } from '@/lib/search.js';
import { postTextMessage } from '@/lib/post-message.js';
import { getVnocAccess, searchSprints, resolveDomain, createTask, taskUrl } from '@/lib/vnoc.js';
import { ONLINE_WINDOW_SECONDS } from '@/lib/presence.js';
import { APP_URL } from '@/lib/email.js';
import { CORS } from '@/lib/oauth-http.js';
import { issuerFor } from '@/lib/oauth.js';

// AppChat MCP server (Streamable HTTP, JSON responses). Auth: "Authorization: Bearer appc_…" —
// a personal connection key from AppChat; every tool acts as that person and sees only what they can.
const PROTOCOL_VERSION = '2025-06-18';

const TOOLS = [
  {
    name: 'list_workspaces',
    description: 'List the AppChat workspaces you belong to (slug, name, your role).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_channels',
    description: 'List the channels and direct messages you are in within a workspace, with unread counts.',
    inputSchema: { type: 'object', properties: { workspace: { type: 'string', description: 'Workspace slug from list_workspaces' } }, required: ['workspace'] },
  },
  {
    name: 'read_channel',
    description: 'Read recent messages in a channel or DM (oldest first). Use before_id to page back.',
    inputSchema: {
      type: 'object',
      properties: {
        channel_id: { type: 'integer' },
        limit: { type: 'integer', description: 'Max messages (default 50, max 200)' },
        before_id: { type: 'integer', description: 'Only messages older than this message id' },
      },
      required: ['channel_id'],
    },
  },
  {
    name: 'read_thread',
    description: 'Read a thread: the parent message and all replies.',
    inputSchema: { type: 'object', properties: { channel_id: { type: 'integer' }, message_id: { type: 'integer' } }, required: ['channel_id', 'message_id'] },
  },
  {
    name: 'search_messages',
    description: 'Full-text search messages across your channels and DMs in a workspace. Use "quotes" for exact phrases.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { type: 'string' },
        query: { type: 'string' },
        channel_id: { type: 'integer', description: 'Limit to one channel' },
        sort: { type: 'string', enum: ['relevant', 'recent'] },
        limit: { type: 'integer', description: 'Default 20, max 100' },
      },
      required: ['workspace', 'query'],
    },
  },
  {
    name: 'post_message',
    description: 'Post a message as you in a channel or DM (optionally as a thread reply). @Name mentions notify people.',
    inputSchema: {
      type: 'object',
      properties: { channel_id: { type: 'integer' }, text: { type: 'string' }, thread_id: { type: 'integer', description: 'Reply in this thread' } },
      required: ['channel_id', 'text'],
    },
  },
  {
    name: 'who_is_online',
    description: "Who's online in a workspace right now and where they are (channel or meeting), plus local time zone.",
    inputSchema: { type: 'object', properties: { workspace: { type: 'string' } }, required: ['workspace'] },
  },
  {
    name: 'vnoc_search_sprints',
    description: 'Search VNOC sprints across the domains you can access (admins: all). Optional domain filter.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, domain: { type: 'string', description: 'e.g. zipsite.com' } } },
  },
  {
    name: 'vnoc_add_task',
    description: "Add a task to a VNOC domain's sprint (latest sprint unless sprint_id is given). Optionally post it into a channel.",
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['urgent', 'high', 'normal', 'low'] },
        assignee: { type: 'string', description: 'Name or email' },
        sprint_id: { type: 'integer' },
        channel_id: { type: 'integer', description: 'Post the new task as a card here' },
      },
      required: ['domain', 'title'],
    },
  },
];

function fail(msg) {
  throw Object.assign(new Error(msg), { toolError: true });
}

async function requireChannel(user, channelId) {
  const ch = await queryOne(
    `SELECT c.id, c.name, c.is_dm, c.tenant_id, t.slug FROM channels c
     JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ?
     JOIN tenants t ON t.id = c.tenant_id WHERE c.id = ?`,
    [user.id, channelId]
  );
  if (!ch) fail('Channel not found, or you are not a member of it');
  return ch;
}

const shape = (m) => ({
  id: m.id,
  author: m.author_name || m.author_email || (m.metadata && (typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata)?.author?.name) || (m.type === 'system' ? 'system' : 'unknown'),
  text: m.body,
  at: m.created_at,
  ...(m.edited_at && { edited: true }),
  ...(m.reply_count && { replies: m.reply_count }),
  ...(m.reactions?.length && { reactions: m.reactions.map((r) => `${r.emoji}×${r.count}`).join(' ') }),
  ...(m.attachments?.length && { attachments: m.attachments.map((a) => a.title || a.url) }),
});

const handlers = {
  async list_workspaces(user) {
    return (await getUserTenants(user.id)).map((t) => ({ slug: t.slug, name: t.name, role: t.role, url: `${APP_URL}/${t.slug}` }));
  },

  async list_channels(user, { workspace }) {
    const rows = await query(
      `SELECT c.id, c.name, c.is_private, c.is_dm, c.description,
              (SELECT COALESCE(NULLIF(u.name, ''), u.email) FROM channel_members o JOIN users u ON u.id = o.user_id
                WHERE o.channel_id = c.id AND o.user_id <> ? LIMIT 1) AS dm_with,
              (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id AND m.created_at > cm.last_read_at
                AND m.deleted_at IS NULL AND m.type <> 'system' AND (m.user_id IS NULL OR m.user_id <> ?)) AS unread
       FROM channels c JOIN tenants t ON t.id = c.tenant_id
       JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ?
       WHERE t.slug = ? AND c.archived_at IS NULL ORDER BY c.is_dm, c.name`,
      [user.id, user.id, user.id, workspace]
    );
    return rows.map((c) => ({
      id: c.id,
      name: c.is_dm ? `DM with ${c.dm_with || 'yourself'}` : `#${c.name}`,
      private: Boolean(c.is_private),
      topic: c.description || undefined,
      unread: Number(c.unread || 0),
    }));
  },

  async read_channel(user, { channel_id, limit = 50, before_id }) {
    await requireChannel(user, channel_id);
    const n = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const rows = await query(
      `${MESSAGE_SELECT} WHERE m.channel_id = ? AND m.deleted_at IS NULL AND m.thread_id IS NULL ${before_id ? 'AND m.id < ?' : ''}
       ORDER BY m.created_at DESC, m.id DESC LIMIT ${n}`,
      before_id ? [channel_id, before_id] : [channel_id]
    );
    return (await hydrateMessages(rows.reverse(), user.id)).map(shape);
  },

  async read_thread(user, { channel_id, message_id }) {
    await requireChannel(user, channel_id);
    const rows = await query(
      `${MESSAGE_SELECT} WHERE m.channel_id = ? AND (m.id = ? OR m.thread_id = ?) AND m.deleted_at IS NULL ORDER BY m.created_at, m.id LIMIT 500`,
      [channel_id, message_id, message_id]
    );
    if (!rows.length) fail('Thread not found');
    return (await hydrateMessages(rows, user.id)).map(shape);
  },

  async search_messages(user, { workspace, query: q, channel_id, sort, limit = 20 }) {
    const results = await searchMessages(user, { tenantSlug: workspace, q, channelId: channel_id, sort, limit: Math.min(Number(limit) || 20, 100) });
    return results.map((r) => ({ id: r.id, channel_id: r.channelId, in: r.where, author: r.author, text: r.body, at: r.createdAt, link: `${APP_URL}${r.url}` }));
  },

  async post_message(user, { channel_id, text, thread_id }) {
    await requireChannel(user, channel_id);
    const msg = await postTextMessage(user, channel_id, text, { via: user.token_name || 'AI assistant', threadId: thread_id });
    return { posted: true, id: msg.id };
  },

  async who_is_online(user, { workspace }) {
    const rows = await query(
      `SELECT COALESCE(NULLIF(u.name, ''), u.email) AS name, p.status, p.timezone,
              c.name AS channel, c.is_dm, c.is_private,
              (SELECT 1 FROM channel_members v WHERE v.channel_id = c.id AND v.user_id = ?) AS viewer_in,
              r.name AS meeting
       FROM tenant_members tm JOIN tenants t ON t.id = tm.tenant_id JOIN users u ON u.id = tm.user_id
       JOIN user_presence p ON p.user_id = u.id AND p.tenant_id = t.id AND p.updated_at > NOW() - INTERVAL ${ONLINE_WINDOW_SECONDS} SECOND
       LEFT JOIN channels c ON c.id = p.channel_id LEFT JOIN rooms r ON r.id = p.room_id
       WHERE t.slug = ? AND EXISTS (SELECT 1 FROM tenant_members me WHERE me.tenant_id = t.id AND me.user_id = ?)`,
      [user.id, workspace, user.id]
    );
    return rows.map((r) => ({
      name: r.name,
      status: r.status,
      where: r.meeting ? 'in a meeting' : r.is_dm ? 'in a direct message' : r.channel && (!r.is_private || r.viewer_in) ? `#${r.channel}` : r.channel ? 'in a private channel' : 'browsing',
      timezone: r.timezone || undefined,
    }));
  },

  async vnoc_search_sprints(user, { query: q = '', domain = '' }) {
    const access = await getVnocAccess(user);
    return (await searchSprints(access, { q, domain, limit: 30 })).map((s) => ({
      sprint_id: s.sprint_id, title: s.title, domain: s.domain_name, status: s.status, goal_date: s.goal_date, tasks: `${s.closed_tasks}/${s.total_tasks} done`,
    }));
  },

  async vnoc_add_task(user, { domain, title, description, priority, assignee, sprint_id, channel_id }) {
    const access = await getVnocAccess(user);
    const d = await resolveDomain(access, domain);
    if (!d) fail("That domain isn't in VNOC, or you don't have access to it");
    const { sprint, task } = await createTask({
      domain: d.domain_name, sprintId: Number(sprint_id) || null, title: String(title).slice(0, 220),
      description, priority, assignedTo: assignee, actorEmail: user.email,
    });
    if (channel_id) {
      await requireChannel(user, channel_id);
      await query('INSERT INTO messages (channel_id, user_id, body, type, metadata) VALUES (?, ?, ?, ?, ?)', [
        channel_id, user.id, `Added task "${task.title}" to ${d.domain_name}`, 'text',
        JSON.stringify({ via: user.token_name, card: { kind: 'vnoc_task', taskId: task.task_id, title: task.title, domain: d.domain_name, sprintId: sprint?.sprint_id, sprintTitle: sprint?.title, priority: priority || 'normal', url: taskUrl(task.task_id) } }),
      ]);
    }
    return { task_id: task.task_id, title: task.title, domain: d.domain_name, sprint: sprint?.title, url: taskUrl(task.task_id) };
  },
};

async function handle(user, msg) {
  const { id, method, params = {} } = msg || {};
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const error = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: params.protocolVersion || PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'appchat', title: 'AppChat', version: '1.0.0' },
        instructions: 'AppChat team chat. Start with list_workspaces, then list_channels. Messages you post appear as the signed-in person.',
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call': {
      const fn = handlers[params.name];
      if (!fn) return error(-32602, `Unknown tool: ${params.name}`);
      try {
        const data = await fn(user, params.arguments || {});
        return reply({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: Array.isArray(data) ? { items: data } : data });
      } catch (err) {
        // Tool failures are reported to the model, not as protocol errors.
        return reply({ content: [{ type: 'text', text: err.message || 'Tool failed' }], isError: true });
      }
    }
    default:
      if (id === undefined) return null; // notifications (e.g. notifications/initialized)
      return error(-32601, `Method not found: ${method}`);
  }
}

export async function POST(request) {
  const user = await userFromBearer(request);
  if (!user) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Missing or invalid AppChat connection key (Authorization: Bearer appc_…)' } },
      {
        status: 401,
        headers: {
          ...CORS,
          'Access-Control-Expose-Headers': 'WWW-Authenticate',
          'WWW-Authenticate': `Bearer realm="appchat", resource_metadata="${issuerFor(request)}/.well-known/oauth-protected-resource"`,
        },
      }
    );
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handle(user, m)))).filter(Boolean);
    return out.length ? NextResponse.json(out, { headers: CORS }) : new NextResponse(null, { status: 202, headers: CORS });
  }
  const out = await handle(user, body);
  return out ? NextResponse.json(out, { headers: CORS }) : new NextResponse(null, { status: 202, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Expose-Headers': 'WWW-Authenticate' } });
}

// This server doesn't push server-initiated messages, so there's no SSE stream.
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}
