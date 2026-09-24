import 'server-only';
import { query } from './db.js';

export const ONLINE_WINDOW_SECONDS = 90;

// Direct-message channels the user is in, with the other person (or themselves for a notes-to-self DM).
export async function listDms(tenantId, userId) {
  return query(
    `SELECT c.id, COALESCE(peer.id, me_user.id) AS peer_id,
            COALESCE(peer.name, me_user.name) AS peer_name,
            COALESCE(peer.email, me_user.email) AS peer_email,
            COALESCE(peer.avatar_url, me_user.avatar_url) AS peer_avatar
     FROM channels c
     JOIN channel_members me ON me.channel_id = c.id AND me.user_id = ?
     JOIN users me_user ON me_user.id = me.user_id
     LEFT JOIN channel_members o ON o.channel_id = c.id AND o.user_id <> me.user_id
     LEFT JOIN users peer ON peer.id = o.user_id
     WHERE c.tenant_id = ? AND c.is_dm = 1
     ORDER BY c.id DESC`,
    [userId, tenantId]
  );
}
