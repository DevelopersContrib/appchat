import 'server-only';
import { query, queryOne, insert } from './db.js';

export const INVITE_COOKIE = 'appchat_invite';

/** A usable invite link (not expired, uses left) with its workspace, or null. */
export async function findInvite(token) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token || '')) return null;
  return queryOne(
    `SELECT i.*, t.slug, t.name AS tenant_name, t.domain AS tenant_domain
     FROM invite_links i JOIN tenants t ON t.id = i.tenant_id
     WHERE i.token = ? AND (i.expires_at IS NULL OR i.expires_at > NOW())
       AND (i.max_uses IS NULL OR i.uses < i.max_uses)`,
    [token]
  );
}

/** Adds the user to the invite's workspace (and its public channels, plus the invite's channel). */
export async function acceptInvite(invite, userId) {
  const existing = await queryOne('SELECT id FROM tenant_members WHERE tenant_id = ? AND user_id = ?', [invite.tenant_id, userId]);
  if (!existing) {
    await insert('INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, ?)', [invite.tenant_id, userId, 'member']);
    await query(
      'INSERT IGNORE INTO channel_members (channel_id, user_id) SELECT id, ? FROM channels WHERE tenant_id = ? AND is_private = 0 AND is_dm = 0 AND archived_at IS NULL',
      [userId, invite.tenant_id]
    );
    await query('UPDATE invite_links SET uses = uses + 1 WHERE id = ?', [invite.id]);
  }
  if (invite.channel_id) {
    await query('INSERT IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)', [invite.channel_id, userId]);
  }
  return { url: invite.channel_id ? `/${invite.slug}/c/${invite.channel_id}` : `/${invite.slug}`, joined: !existing };
}
