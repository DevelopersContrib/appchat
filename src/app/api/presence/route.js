import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { query, queryOne } from '@/lib/db.js';
import { requireMembership } from '@/lib/tenant.js';
import { listDms, ONLINE_WINDOW_SECONDS } from '@/lib/presence.js';
import { contribProfileUrl } from '@/lib/contrib.js';

// Heartbeat: the open app reports where the user is (channel or meeting) every ~30s.
export async function POST(request) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const status = body.status === 'away' ? 'away' : 'active';
  const timezone = typeof body.timezone === 'string' && /^[\w+\-/]{1,64}$/.test(body.timezone) ? body.timezone : null;

  let tenantId = null;
  let channelId = null;
  let roomId = null;

  if (body.channelId) {
    const ch = await queryOne(
      `SELECT c.id, c.tenant_id FROM channels c
       JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ? WHERE c.id = ?`,
      [user.id, body.channelId]
    );
    if (ch) ({ id: channelId, tenant_id: tenantId } = ch);
  } else if (body.room) {
    const room = await queryOne(
      `SELECT r.id, r.tenant_id FROM rooms r
       JOIN tenant_members tm ON tm.tenant_id = r.tenant_id AND tm.user_id = ?
       WHERE r.livekit_room = ? AND r.status IN ('waiting', 'active')`,
      [user.id, String(body.room)]
    );
    if (room) ({ id: roomId, tenant_id: tenantId } = room);
  }
  if (!tenantId && body.tenant) {
    const m = await requireMembership(String(body.tenant), user.id).catch(() => null);
    tenantId = m?.tenant_id ?? null;
  }

  await query(
    `INSERT INTO user_presence (user_id, tenant_id, channel_id, room_id, status, timezone, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), channel_id = VALUES(channel_id), room_id = VALUES(room_id),
       status = VALUES(status), timezone = COALESCE(VALUES(timezone), timezone), updated_at = NOW()`,
    [user.id, tenantId, channelId, roomId, status, timezone]
  );
  await query('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [user.id]);
  return NextResponse.json({ ok: true });
}

// Workspace roster with who's online and where, plus the viewer's DMs and unread counts.
export async function GET(request) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const slug = request.nextUrl.searchParams.get('tenant');
  const membership = await requireMembership(slug, user.id).catch(() => null);
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  const tenantId = membership.tenant_id;

  const rows = await query(
    `SELECT u.id, u.name, u.email, u.avatar_url, u.last_seen_at, u.contrib_username, tm.role,
            p.status, p.timezone, p.updated_at AS presence_at,
            (p.tenant_id = ? AND p.updated_at > NOW() - INTERVAL ${ONLINE_WINDOW_SECONDS} SECOND) AS online,
            c.id AS channel_id, c.name AS channel_name, c.is_dm, c.is_private,
            (SELECT 1 FROM channel_members v WHERE v.channel_id = c.id AND v.user_id = ?) AS viewer_in_channel,
            r.name AS room_name,
            (SELECT COUNT(*) FROM kudos k WHERE k.tenant_id = tm.tenant_id AND k.to_user_id = u.id) AS kudos
     FROM tenant_members tm
     JOIN users u ON u.id = tm.user_id
     LEFT JOIN user_presence p ON p.user_id = u.id
     LEFT JOIN channels c ON c.id = p.channel_id
     LEFT JOIN rooms r ON r.id = p.room_id
     WHERE tm.tenant_id = ?
     ORDER BY online DESC, COALESCE(NULLIF(u.name, ''), u.email)`,
    [tenantId, user.id, tenantId]
  );

  const members = rows.map((r) => {
    const online = Boolean(r.online);
    let where = null;
    if (online) {
      // Never reveal private channels or who someone is DMing to people outside them.
      if (r.room_name) where = { type: 'meeting', label: `In a meeting${r.room_name ? `: ${r.room_name}` : ''}` };
      else if (r.is_dm) where = { type: 'dm', label: 'In a direct message' };
      else if (r.channel_id && r.is_private && !r.viewer_in_channel) where = { type: 'private', label: 'In a private channel' };
      else if (r.channel_id) where = { type: 'channel', label: `In #${r.channel_name}`, channelId: r.channel_id };
      else where = { type: 'app', label: 'Browsing the workspace' };
    }
    return {
      id: r.id,
      name: r.name || r.email.split('@')[0],
      email: r.email,
      avatar: r.avatar_url,
      role: r.role,
      online,
      status: online ? r.status : 'offline',
      where,
      timezone: r.timezone,
      lastSeenAt: r.last_seen_at,
      contribUrl: contribProfileUrl(r.contrib_username),
      kudos: Number(r.kudos || 0),
    };
  });

  const unreadRows = await query(
    `SELECT c.id, COUNT(m.id) AS unread
     FROM channels c
     JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ?
     JOIN messages m ON m.channel_id = c.id AND m.created_at > cm.last_read_at
       AND (m.user_id IS NULL OR m.user_id <> ?) AND m.type <> 'system' AND m.deleted_at IS NULL
     WHERE c.tenant_id = ?
     GROUP BY c.id`,
    [user.id, user.id, tenantId]
  );
  const unread = Object.fromEntries(unreadRows.map((r) => [r.id, Number(r.unread)]));

  return NextResponse.json({ members, dms: await listDms(tenantId, user.id), unread });
}
