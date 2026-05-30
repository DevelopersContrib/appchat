import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';

export async function POST(request) {
  try {
    const user = await requireSession();
    const { name, tenantSlug } = await request.json();

    if (!process.env.DAILY_API_KEY) {
      return NextResponse.json({ error: 'Daily.co not configured' }, { status: 503 });
    }

    const roomName = `${tenantSlug}-${name || Date.now()}`.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40);

    const res = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'public',
        properties: {
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: false,
          exp: Math.floor(Date.now() / 1000) + 86400,
          max_participants: 20,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.info || 'Failed to create room' }, { status: 500 });
    }

    const room = await res.json();

    return NextResponse.json({
      name: room.name,
      url: room.url,
      domain: process.env.NEXT_PUBLIC_DAILY_DOMAIN,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
