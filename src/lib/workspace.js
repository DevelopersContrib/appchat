import 'server-only';
import { NextResponse } from 'next/server';
import { getSession } from './auth.js';
import { insert, query, queryOne } from './db.js';
import { requireTenantAdmin, getTenantBySlug } from './tenant.js';
import { parseTenantSettings } from './brand-agent-profiles.js';

export { parseTenantSettings };

// Wraps /api/workspace/[slug]/* admin routes: signed-in workspace owner/admin (or platform admin).
export function withWorkspaceAdmin(handler) {
  return async (request, ctx) => {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { slug } = await ctx.params;
    const admin = await requireTenantAdmin(slug, user).catch(() => null);
    if (!admin) return NextResponse.json({ error: 'Only workspace admins can do that' }, { status: 403 });
    const tenant = await getTenantBySlug(slug);
    try {
      return await handler(request, { user, tenant, settings: parseTenantSettings(tenant.settings) });
    } catch (err) {
      console.error('[workspace]', err);
      return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 400 });
    }
  };
}

export async function audit(tenantId, actorId, action, target, details) {
  await insert(
    'INSERT INTO audit_log (tenant_id, actor_id, action, target, details) VALUES (?, ?, ?, ?, ?)',
    [tenantId, actorId, action, target ? String(target).slice(0, 255) : null, details ? JSON.stringify(details) : null]
  ).catch((err) => console.error('[audit]', err.message));
}

export async function saveSettings(tenantId, settings) {
  await query('UPDATE tenants SET settings = ? WHERE id = ?', [JSON.stringify(settings), tenantId]);
}

/** Replaces banned words with asterisks. Returns the cleaned text. */
export function applyWordFilter(text, bannedWords = []) {
  if (!text || !bannedWords.length) return text;
  let out = text;
  for (const word of bannedWords) {
    const w = String(word).trim();
    if (!w) continue;
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    out = out.replace(re, (m) => '*'.repeat(m.length));
  }
  return out;
}

/** Throws if the member is muted in the channel's workspace. */
export async function assertCanPost(channelId, userId) {
  const row = await queryOne(
    `SELECT tm.muted_until, t.settings FROM channels c
     JOIN tenants t ON t.id = c.tenant_id
     LEFT JOIN tenant_members tm ON tm.tenant_id = c.tenant_id AND tm.user_id = ?
     WHERE c.id = ?`,
    [userId, channelId]
  );
  if (row?.muted_until && new Date(row.muted_until) > new Date()) {
    const until = new Date(row.muted_until).toUTCString();
    const err = new Error(`You're muted in this workspace until ${until}.`);
    err.status = 403;
    throw err;
  }
  return parseTenantSettings(row?.settings);
}
