import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { requireSession } from '@/lib/auth.js';
import { queryOne } from '@/lib/db.js';

export async function POST(request) {
  try {
    await requireSession();
    const { room } = await request.json();

    if (!room || typeof room !== 'string') {
      return NextResponse.json({ error: 'Room is required' }, { status: 400 });
    }

    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 503 });
    }

    const roomRow = await queryOne(
      `SELECT r.livekit_room, t.slug, t.domain
       FROM rooms r
       JOIN tenants t ON t.id = r.tenant_id
       WHERE r.livekit_room = ?
       LIMIT 1`,
      [room]
    );

    if (!roomRow) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const brandDomain = roomRow.domain || `${roomRow.slug}.com`;
    const brandLogo = `https://www.brandidentity.com/logo/${brandDomain}`;
    const metadata = JSON.stringify({
      role: 'brand-agent',
      brandDomain,
      favicon: `https://www.brandidentity.com/favicon/${brandDomain}`,
      logo: brandLogo,
    });

    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: `brand-agent-${room}`,
        name: 'Brand Agent',
        metadata,
      }
    );

    token.addGrant({
      room,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();
    return NextResponse.json({ token: jwt, brandDomain, brandLogo });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
