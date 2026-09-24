import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth.js';
import { queryOne, query } from '@/lib/db.js';
import ChannelView from '@/components/ChannelView.jsx';

export default async function ChannelPage({ params }) {
  const { tenant: slug, channelId } = await params;
  const user = await getSession();
  if (!user) redirect('/login');

  const channel = await queryOne(
    `SELECT c.* FROM channels c
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

  // Latest 100, oldest first. Imported history can make channels far longer than one page.
  const messages = (await query(
    `SELECT m.*, u.name as author_name, u.email as author_email, u.avatar_url as author_avatar
     FROM messages m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.channel_id = ?
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT 100`,
    [channelId]
  )).reverse();

  const members = await query(
    `SELECT u.id, u.name, u.email, u.avatar_url, u.last_seen_at
     FROM channel_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.channel_id = ?`,
    [channelId]
  );

  return (
    <ChannelView
      channel={channel}
      initialMessages={JSON.parse(JSON.stringify(messages))}
      members={members}
      currentUser={JSON.parse(JSON.stringify(user))}
      tenantSlug={slug}
    />
  );
}
