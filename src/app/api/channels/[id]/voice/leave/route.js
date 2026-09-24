import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query } from '@/lib/db.js';

// sendBeacon target when the tab closes while in voice.
export async function POST(request, { params }) {
  const user = await getSession();
  if (!user) return new NextResponse(null, { status: 204 });
  const { id } = await params;
  await query('UPDATE user_presence SET voice_channel_id = NULL WHERE user_id = ? AND voice_channel_id = ?', [user.id, id]);
  return new NextResponse(null, { status: 204 });
}
