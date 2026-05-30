import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { requireSession } from '@/lib/auth.js';

export async function POST(request) {
  try {
    const user = await requireSession();
    const { room } = await request.json();

    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 503 });
    }

    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: String(user.id),
        name: user.name || user.email,
      }
    );

    token.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();
    return NextResponse.json({ token: jwt });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
