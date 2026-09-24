import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { query, queryOne, insert } from '@/lib/db.js';
import { withWorkspaceAdmin, audit } from '@/lib/workspace.js';
import { APP_URL } from '@/lib/email.js';

const linkUrl = (token) => `${APP_URL}/join/${token}`;

export const GET = withWorkspaceAdmin(async (request, { tenant }) => {
  const links = await query(
    `SELECT i.id, i.token, i.expires_at, i.max_uses, i.uses, i.created_at, c.name AS channel_name,
            COALESCE(NULLIF(u.name, ''), u.email) AS created_by_name
     FROM invite_links i LEFT JOIN channels c ON c.id = i.channel_id LEFT JOIN users u ON u.id = i.created_by
     WHERE i.tenant_id = ? AND (i.expires_at IS NULL OR i.expires_at > NOW()) AND i.room_id IS NULL
     ORDER BY i.id DESC`,
    [tenant.id]
  );
  return NextResponse.json({ links: links.map((l) => ({ ...l, url: linkUrl(l.token) })) });
});

// Create a join link: optional expiry (days), use limit, and a channel to land in.
export const POST = withWorkspaceAdmin(async (request, { user, tenant }) => {
  const b = await request.json().catch(() => ({}));
  const days = Math.min(Math.max(Number(b.expiresInDays) || 0, 0), 365);
  const maxUses = Math.min(Math.max(Number(b.maxUses) || 0, 0), 10000) || null;
  let channelId = null;
  if (b.channelId) {
    const ch = await queryOne('SELECT id FROM channels WHERE id = ? AND tenant_id = ? AND is_dm = 0 AND archived_at IS NULL', [b.channelId, tenant.id]);
    channelId = ch?.id || null;
  }
  const token = nanoid(24);
  await insert(
    `INSERT INTO invite_links (tenant_id, token, channel_id, created_by, expires_at, max_uses)
     VALUES (?, ?, ?, ?, ${days ? 'NOW() + INTERVAL ? DAY' : 'NULL'}, ?)`,
    days ? [tenant.id, token, channelId, user.id, days, maxUses] : [tenant.id, token, channelId, user.id, maxUses]
  );
  await audit(tenant.id, user.id, 'invite_link.create', token.slice(0, 6) + '…', { days, maxUses, channelId });
  return NextResponse.json({ url: linkUrl(token), token }, { status: 201 });
});

// Revoke a link (it stops working immediately).
export const DELETE = withWorkspaceAdmin(async (request, { user, tenant }) => {
  const id = Number(request.nextUrl.searchParams.get('id'));
  const res = await query('DELETE FROM invite_links WHERE id = ? AND tenant_id = ?', [id, tenant.id]);
  if (res.affectedRows) await audit(tenant.id, user.id, 'invite_link.revoke', String(id));
  return NextResponse.json({ ok: true });
});
