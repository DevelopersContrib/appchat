import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getSession } from '@/lib/auth.js';
import { query } from '@/lib/db.js';
import { getChannelAccess } from '@/lib/channels.js';

const DOMAIN = process.env.INBOUND_EMAIL_DOMAIN || 'appchat.com';
const address = (token) => (token ? `c-${token}@${DOMAIN}` : null);

// This channel's email address (members can see it).
export async function GET(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const access = await getChannelAccess(id, user);
  if (!access?.isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  // Hidden until incoming mail is routed to AppChat (INBOUND_EMAIL_ENABLED=1).
  if (process.env.INBOUND_EMAIL_ENABLED !== '1') return NextResponse.json({ enabled: false });
  return NextResponse.json({ enabled: true, address: address(access.channel.email_token), canManage: access.canManage });
}

// Create or replace the address (the old one stops working). Channel creator or admins.
export async function POST(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const access = await getChannelAccess(id, user);
  if (!access?.canManage) return NextResponse.json({ error: 'Only the channel creator or an admin can change this' }, { status: 403 });
  const token = nanoid(10).toLowerCase().replace(/[^a-z0-9]/g, 'x');
  await query('UPDATE channels SET email_token = ? WHERE id = ?', [token, access.channel.id]);
  return NextResponse.json({ address: address(token) });
}

// Turn the address off.
export async function DELETE(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const access = await getChannelAccess(id, user);
  if (!access?.canManage) return NextResponse.json({ error: 'Only the channel creator or an admin can change this' }, { status: 403 });
  await query('UPDATE channels SET email_token = NULL WHERE id = ?', [access.channel.id]);
  return NextResponse.json({ address: null });
}
