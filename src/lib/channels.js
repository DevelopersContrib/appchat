import 'server-only';
import { queryOne } from './db.js';

export function channelName(raw) {
  return String(raw || '').trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/**
 * What the user may do with a channel.
 * canManage: rename, change privacy, archive, remove members — channel creator or workspace owner/admin.
 */
export async function getChannelAccess(channelId, user) {
  const row = await queryOne(
    `SELECT c.*, t.slug AS tenant_slug, tm.role,
            (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?) AS is_member
     FROM channels c
     JOIN tenants t ON t.id = c.tenant_id
     LEFT JOIN tenant_members tm ON tm.tenant_id = c.tenant_id AND tm.user_id = ?
     WHERE c.id = ?`,
    [user.id, user.id, channelId]
  );
  if (!row || (!row.role && !user.is_admin)) return null;
  const isAdmin = ['owner', 'admin'].includes(row.role) || Boolean(user.is_admin);
  return {
    channel: row,
    isMember: Boolean(row.is_member),
    // Private channels are invisible to non-members (admins can still manage them).
    canView: Boolean(row.is_member) || (!row.is_private && !row.is_dm) || isAdmin,
    canManage: !row.is_dm && (isAdmin || row.created_by === user.id),
    isAdmin,
  };
}
