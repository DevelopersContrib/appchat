import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth.js';
import { queryOne, query } from '@/lib/db.js';
import ChannelView from '@/components/ChannelView.jsx';
import { MESSAGE_SELECT, hydrateMessages } from '@/lib/messages.js';

export default async function ChannelPage({ params }) {
  const { tenant: slug, channelId } = await params;
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

  // Latest 100 top-level messages, oldest first (thread replies live in the thread panel).
  const messages = await hydrateMessages(
    (await query(
      `${MESSAGE_SELECT} WHERE m.channel_id = ? AND m.deleted_at IS NULL AND m.thread_id IS NULL
       ORDER BY m.created_at DESC, m.id DESC LIMIT 100`,
      [channelId]
    )).reverse(),
    user.id
  );

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
