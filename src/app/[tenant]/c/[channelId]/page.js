import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth.js';
import { queryOne, query } from '@/lib/db.js';
import ChannelView from '@/components/ChannelView.jsx';
import { MESSAGE_SELECT, hydrateMessages } from '@/lib/messages.js';

export default async function ChannelPage({ params, searchParams }) {
  const { tenant: slug, channelId } = await params;
  const { m: focusParam, t: threadParam } = await searchParams;
  const user = await getSession();
  if (!user) redirect('/login');

  const channel = await queryOne(
    `SELECT c.*, COALESCE(t.domain, CONCAT(t.slug, '.com')) AS tenant_domain FROM channels c
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.id = ? AND t.slug = ?`,
    [channelId, slug]
  );

  if (!channel) redirect(`/${slug}`);

  const isMember = await queryOne(
    'SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
    [channel.id, user.id]
  );
  if (!isMember) redirect(`/${slug}`);

  // ?m=<id> (from search): load the conversation around that message instead of the latest.
  const focus = focusParam
    ? await queryOne(
        'SELECT id, created_at FROM messages WHERE id = ? AND channel_id = ? AND deleted_at IS NULL AND thread_id IS NULL',
        [focusParam, channelId]
      )
    : null;

  let rows;
  if (focus) {
    const before = await query(
      `${MESSAGE_SELECT} WHERE m.channel_id = ? AND m.deleted_at IS NULL AND m.thread_id IS NULL
         AND (m.created_at < ? OR (m.created_at = ? AND m.id < ?))
       ORDER BY m.created_at DESC, m.id DESC LIMIT 40`,
      [channelId, focus.created_at, focus.created_at, focus.id]
    );
    const after = await query(
      `${MESSAGE_SELECT} WHERE m.channel_id = ? AND m.deleted_at IS NULL AND m.thread_id IS NULL
         AND (m.created_at > ? OR (m.created_at = ? AND m.id >= ?))
       ORDER BY m.created_at ASC, m.id ASC LIMIT 41`,
      [channelId, focus.created_at, focus.created_at, focus.id]
    );
    rows = [...before.reverse(), ...after];
  } else {
    // Latest 100 top-level messages, oldest first (thread replies live in the thread panel).
    rows = (await query(
      `${MESSAGE_SELECT} WHERE m.channel_id = ? AND m.deleted_at IS NULL AND m.thread_id IS NULL
       ORDER BY m.created_at DESC, m.id DESC LIMIT 100`,
      [channelId]
    )).reverse();
  }
  const messages = await hydrateMessages(rows, user.id);

  const members = await query(
    `SELECT u.id, u.name, u.email, u.avatar_url, u.last_seen_at
     FROM channel_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.channel_id = ?`,
    [channelId]
  );

  const membership = await queryOne(
    'SELECT role FROM tenant_members WHERE tenant_id = ? AND user_id = ?',
    [channel.tenant_id, user.id]
  );
  const canModerate = ['owner', 'admin'].includes(membership?.role) || Boolean(user.is_admin);

  // In a DM, the header shows the other person instead of the internal channel name.
  const dmPeer = channel.is_dm ? (members.find((m) => m.id !== user.id) || members[0] || null) : null;

  return (
    <ChannelView
      key={focus ? `focus-${focus.id}` : 'latest'}
      focusId={focus?.id || null}
      initialThreadId={focus && threadParam ? Number(threadParam) : null}
      canModerate={canModerate}
      dmPeer={dmPeer ? JSON.parse(JSON.stringify(dmPeer)) : null}
      channel={channel}
      initialMessages={JSON.parse(JSON.stringify(messages))}
      members={members}
      currentUser={JSON.parse(JSON.stringify(user))}
      tenantSlug={slug}
    />
  );
}
