import { NextResponse } from 'next/server';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { getSession } from '@/lib/auth.js';
import { query, queryOne } from '@/lib/db.js';

const voiceRoomName = (channelId) => `appchat-voice-${channelId}`;

async function memberChannel(user, id) {
  return queryOne(
    `SELECT c.id, c.name, c.tenant_id FROM channels c JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ?
     WHERE c.id = ? AND c.archived_at IS NULL`,
    [user.id, id]
  );
}

// Join this channel's voice room: a LiveKit token scoped to that room, for channel members only.
export async function POST(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const ch = await memberChannel(user, id);
  if (!ch) return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 });
  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return NextResponse.json({ error: 'Voice isn’t set up on this server' }, { status: 503 });
  }

  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: String(user.id),
    name: user.name || user.email,
    metadata: JSON.stringify({ avatar: user.avatar_url || null }),
    ttl: '6h',
  });
  at.addGrant({ room: voiceRoomName(ch.id), roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });

  await query(
    `INSERT INTO user_presence (user_id, tenant_id, voice_channel_id, updated_at) VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE voice_channel_id = VALUES(voice_channel_id)`,
    [user.id, ch.tenant_id, ch.id]
  );
  return NextResponse.json({ token: await at.toJwt(), url: process.env.NEXT_PUBLIC_LIVEKIT_URL, room: voiceRoomName(ch.id), channelName: ch.name });
}

// Leave voice.
export async function DELETE(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await query('UPDATE user_presence SET voice_channel_id = NULL WHERE user_id = ? AND voice_channel_id = ?', [user.id, id]);
  return NextResponse.json({ ok: true });
}

// Who's in this channel's voice room right now (from LiveKit).
export async function GET(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await memberChannel(user, id))) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  try {
    const host = process.env.NEXT_PUBLIC_LIVEKIT_URL.replace(/^wss:/, 'https:');
    const svc = new RoomServiceClient(host, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
    const people = await svc.listParticipants(voiceRoomName(id));
    return NextResponse.json({ participants: people.map((p) => ({ id: p.identity, name: p.name })) });
  } catch {
    return NextResponse.json({ participants: [] });
  }
}
