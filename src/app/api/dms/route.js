import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { query, queryOne, insert } from '@/lib/db.js';
import { requireMembership } from '@/lib/tenant.js';

// Open (or create) the one-to-one DM between the viewer and another workspace member.
export async function POST(request) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { tenant, userId } = await request.json().catch(() => ({}));
  const membership = await requireMembership(String(tenant || ''), user.id).catch(() => null);
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const peerId = Number(userId);
  const peer = await queryOne(
    'SELECT user_id FROM tenant_members WHERE tenant_id = ? AND user_id = ?',
    [membership.tenant_id, peerId]
  );
  if (!peer) return NextResponse.json({ error: 'That person is not in this workspace' }, { status: 404 });

  // Deterministic name keeps one DM per pair: dm-<lower id>-<higher id>.
  const [a, b] = [user.id, peerId].sort((x, y) => x - y);
  const name = `dm-${a}-${b}`;
  let channel = await queryOne(
    'SELECT id FROM channels WHERE tenant_id = ? AND is_dm = 1 AND name = ? LIMIT 1',
    [membership.tenant_id, name]
  );
  if (!channel) {
    const id = await insert(
      'INSERT INTO channels (tenant_id, name, is_private, is_dm, created_by) VALUES (?, ?, 1, 1, ?)',
      [membership.tenant_id, name, user.id]
    );
    await query(
      'INSERT IGNORE INTO channel_members (channel_id, user_id, last_read_at) VALUES (?, ?, NOW()), (?, ?, NOW())',
      [id, a, id, b]
    );
    channel = { id };
  }

  // Reopening a closed DM brings it back to the sidebar.
  await query('UPDATE channel_members SET hidden_at = NULL WHERE channel_id = ? AND user_id = ?', [channel.id, user.id]);

  return NextResponse.json({ channelId: channel.id, url: `/${membership.slug}/c/${channel.id}` });
}
