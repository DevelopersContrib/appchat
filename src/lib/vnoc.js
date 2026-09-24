import 'server-only';
import { getVnocPool } from './domains.js';

// VNOC sprints & tasks (vnoc/manage-app). Sprints are domain_tasks rows with is_milestone = 1;
// tasks are rows whose parent_id is the sprint. Reads go straight to the VNOC database;
// writes go through manage-app's API so its validation, latin1 handling and defaults apply.
const API_BASE = process.env.VNOC_API_BASE || 'https://app.vnoc.com/api/v1/mcp';
export const VNOC_APP_URL = process.env.VNOC_APP_URL || 'https://app.vnoc.com';

async function vq(sql, params = []) {
  const [rows] = await getVnocPool().query(sql, params);
  return rows;
}

async function vnocApi(path, { method = 'GET', query, body } = {}) {
  if (!process.env.VNOC_EXTERNAL_API_KEY) throw new Error('VNOC API is not configured');
  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method,
    headers: { 'x-api-key': process.env.VNOC_EXTERNAL_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `VNOC API error ${res.status}`);
  return data;
}

/**
 * Who the AppChat user is in VNOC. Admins (AppChat platform admins or VNOC members.is_admin)
 * can work on any domain; everyone else only on domains they own or are on the team of.
 */
export async function getVnocAccess(user) {
  const [member] = await vq(
    'SELECT member_id, is_admin FROM members WHERE LOWER(email) = LOWER(?) ORDER BY is_active DESC LIMIT 1',
    [user.email]
  );
  return {
    memberId: member?.member_id ?? null,
    isAdmin: Boolean(user.is_admin || member?.is_admin),
  };
}

// SQL condition limiting domain alias `d` to what this user may see.
function domainScope(access) {
  if (access.isAdmin) return { sql: '1 = 1', params: [] };
  if (!access.memberId) return { sql: '1 = 0', params: [] };
  return {
    sql: `(d.member_id = ? OR d.domain_id IN (
            SELECT t.domain_id FROM team t JOIN team_member tm ON tm.team_id = t.team_id WHERE tm.member_id = ?))`,
    params: [access.memberId, access.memberId],
  };
}

export function normalizeDomain(input) {
  return String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

export async function resolveDomain(access, domainInput) {
  const name = normalizeDomain(domainInput);
  if (!name) return null;
  const scope = domainScope(access);
  const [row] = await vq(
    `SELECT d.domain_id, d.domain_name FROM domain d WHERE d.domain_name = ? AND ${scope.sql} LIMIT 1`,
    [name, ...scope.params]
  );
  return row || null;
}

export async function searchDomains(access, q, limit = 20) {
  const scope = domainScope(access);
  return vq(
    `SELECT d.domain_id, d.domain_name FROM domain d
     WHERE d.domain_name LIKE ? AND ${scope.sql}
     ORDER BY d.domain_name = ? DESC, LENGTH(d.domain_name), d.domain_name
     LIMIT ?`,
    [`%${normalizeDomain(q)}%`, ...scope.params, normalizeDomain(q), limit]
  );
}

/** Sprints the user can see, optionally within one domain and/or matching text in the title. */
export async function searchSprints(access, { q = '', domain = '', limit = 30 } = {}) {
  const scope = domainScope(access);
  const where = ['s.is_milestone = 1', scope.sql];
  const params = [...scope.params];
  if (domain) {
    where.push('d.domain_name = ?');
    params.push(normalizeDomain(domain));
  }
  if (q.trim()) {
    where.push('(s.title LIKE ? OR d.domain_name LIKE ?)');
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }
  const rows = await vq(
    `SELECT s.task_id AS sprint_id, s.title, s.status, s.goal_date, s.date_created,
            d.domain_id, d.domain_name,
            (SELECT COUNT(*) FROM domain_tasks t WHERE t.parent_id = s.task_id AND t.is_milestone = 0) AS total_tasks,
            (SELECT COUNT(*) FROM domain_tasks t WHERE t.parent_id = s.task_id AND t.is_milestone = 0 AND t.status = 'completed') AS closed_tasks
     FROM domain_tasks s
     JOIN domain d ON d.domain_id = s.domain_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.task_id DESC
     LIMIT ?`,
    [...params, Math.min(Number(limit) || 30, 100)]
  );
  return rows.map((r) => ({ ...r, total_tasks: Number(r.total_tasks), closed_tasks: Number(r.closed_tasks) }));
}

export async function listSprintTasks(domain, sprintId) {
  const data = await vnocApi('sprints/tasks', { query: { domain, sprint_id: sprintId, limit: 200 } });
  return data.tasks || [];
}

export async function createTask({ domain, sprintId, title, description, priority, assignedTo, actorEmail }) {
  const data = await vnocApi('sprints/tasks/add', {
    method: 'POST',
    body: {
      domain,
      title,
      description: description || undefined,
      priority: priority || undefined,
      assigned_to: assignedTo || undefined,
      actor_email: actorEmail,
      ...(sprintId ? { sprint_id: sprintId } : { sprint_mode: 'latest' }),
    },
  });
  return { sprint: data.sprint, task: data.task };
}

export async function createSprint({ domain, title, description, goalDate, actorEmail }) {
  return vnocApi('sprints/create', {
    method: 'POST',
    body: { domain, title, description: description || undefined, goal_date: goalDate || undefined, actor_email: actorEmail },
  });
}

export function taskUrl(taskId) {
  return `${VNOC_APP_URL}/tasks/${taskId}`;
}

/** A VNOC domain's people: the owner plus everyone on its team (active members with an email). */
export async function getDomainTeam(domainId) {
  const rows = await vq(
    `SELECT m.member_id, m.email, m.firstname, m.lastname, m.username, 'owner' AS role
     FROM domain d JOIN members m ON m.member_id = d.member_id
     WHERE d.domain_id = ?
     UNION
     SELECT m.member_id, m.email, m.firstname, m.lastname, m.username, COALESCE(tr.role_name, 'member') AS role
     FROM team t
     JOIN team_member tm ON tm.team_id = t.team_id
     JOIN members m ON m.member_id = tm.member_id
     LEFT JOIN teamrole tr ON tr.role_id = tm.role_id
     WHERE t.domain_id = ?`,
    [domainId, domainId]
  );
  const seen = new Set();
  return rows
    .filter((r) => r.email && /@/.test(r.email))
    .filter((r) => (seen.has(r.email.toLowerCase()) ? false : seen.add(r.email.toLowerCase())))
    .map((r) => ({
      memberId: r.member_id,
      email: r.email.toLowerCase(),
      name: `${r.firstname || ''} ${r.lastname || ''}`.trim() || r.username || r.email.split('@')[0],
      role: r.role,
    }));
}

/**
 * Best-guess VNOC domain for a channel name the user can access, e.g. "realtydao-updates" → realtydao.com.
 * Returns null when nothing plausible exists.
 */
export async function suggestDomainForChannel(access, channelName) {
  const clean = String(channelName || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
  if (clean.length < 3) return null;
  const first = clean.split('-')[0];
  const candidates = [...new Set([clean, clean.replace(/-/g, ''), first].filter((c) => c.length >= 3))].map((c) => `${c}.com`);
  const scope = domainScope(access);
  const [row] = await vq(
    `SELECT d.domain_id, d.domain_name FROM domain d
     WHERE d.domain_name IN (?) AND ${scope.sql}
     ORDER BY FIELD(d.domain_name, ?) LIMIT 1`,
    [candidates, ...scope.params, candidates]
  );
  return row || null;
}
