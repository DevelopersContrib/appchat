import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query, queryOne, insert } from '@/lib/db.js';
import { getChannelAccess, channelName } from '@/lib/channels.js';
import { audit } from '@/lib/workspace.js';
import { sanitizeString } from '@/lib/security.js';

async function load(params) {
  const user = await getSession();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { id } = await params;
  const access = await getChannelAccess(id, user);
  if (!access?.canView) return { error: NextResponse.json({ error: 'Channel not found' }, { status: 404 }) };
  return { user, access };
}

// Channel details + members, for the channel settings dialog.
export async function GET(request, { params }) {
  const { user, access, error } = await load(params);
  if (error) return error;
  const members = await query(
    `SELECT u.id, u.name, u.email, u.avatar_url FROM channel_members cm JOIN users u ON u.id = cm.user_id
     WHERE cm.channel_id = ? ORDER BY COALESCE(NULLIF(u.name, ''), u.email)`,
    [access.channel.id]
  );
  const c = access.channel;
  return NextResponse.json({
    id: c.id,
    name: c.name,
    description: c.description,
    isPrivate: Boolean(c.is_private),
    isDm: Boolean(c.is_dm),
    archived: Boolean(c.archived_at),
    createdBy: c.created_by,
    isMember: access.isMember,
    canManage: access.canManage,
    members,
    me: user.id,
  });
}

// Rename, change topic, switch public/private.
export async function PATCH(request, { params }) {
  const { user, access, error } = await load(params);
  if (error) return error;
  if (!access.canManage) return NextResponse.json({ error: 'Only the channel creator or an admin can change settings' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const c = access.channel;

  const name = b.name !== undefined ? channelName(b.name) : c.name;
  if (!name) return NextResponse.json({ error: 'Name can’t be empty' }, { status: 400 });
  if (name !== c.name) {
    const taken = await queryOne(
      'SELECT id FROM channels WHERE tenant_id = ? AND name = ? AND is_dm = 0 AND archived_at IS NULL AND id <> ?',
      [c.tenant_id, name, c.id]
    );
    if (taken) return NextResponse.json({ error: `#${name} already exists` }, { status: 409 });
  }
  const description = b.description !== undefined ? sanitizeString(b.description, 500) : c.description;
  const isPrivate = b.isPrivate !== undefined ? Boolean(b.isPrivate) : Boolean(c.is_private);

  await query('UPDATE channels SET name = ?, description = ?, is_private = ? WHERE id = ?', [name, description, isPrivate ? 1 : 0, c.id]);
  // Making a channel public lets everyone in the workspace in.
  if (!isPrivate && c.is_private) {
    await query(
      'INSERT IGNORE INTO channel_members (channel_id, user_id) SELECT ?, user_id FROM tenant_members WHERE tenant_id = ?',
      [c.id, c.tenant_id]
    );
  }
  const changes = [];
  if (name !== c.name) changes.push(`renamed #${c.name} to #${name}`);
  if (isPrivate !== Boolean(c.is_private)) changes.push(isPrivate ? 'made the channel private' : 'made the channel public');
  if (description !== c.description) changes.push('updated the topic');
  if (changes.length) {
    await insert('INSERT INTO messages (channel_id, body, type) VALUES (?, ?, ?)', [c.id, `${user.name || user.email} ${changes.join(', ')}`, 'system']);
    await audit(c.tenant_id, user.id, 'channel.update', `#${name}`, { changes });
  }
  return NextResponse.json({ ok: true, name });
}

// Archive (hide from everyone, keep history).
export async function DELETE(request, { params }) {
  const { user, access, error } = await load(params);
  if (error) return error;
  if (!access.canManage) return NextResponse.json({ error: 'Only the channel creator or an admin can archive it' }, { status: 403 });
  await query('UPDATE channels SET archived_at = NOW() WHERE id = ?', [access.channel.id]);
  await audit(access.channel.tenant_id, user.id, 'channel.archive', `#${access.channel.name}`);
  return NextResponse.json({ ok: true, url: `/${access.channel.tenant_slug}` });
}
