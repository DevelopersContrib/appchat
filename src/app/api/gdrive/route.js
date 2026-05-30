import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { getGoogleAuthUrl, getValidToken } from '@/lib/gdrive.js';
import { queryOne } from '@/lib/db.js';

export async function GET(request) {
  try {
    const user = await requireSession();

    const token = await queryOne('SELECT id, expires_at FROM user_google_tokens WHERE user_id = ?', [user.id]);
    const connected = !!token;

    return NextResponse.json({ connected, userId: user.id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

export async function POST(request) {
  try {
    const user = await requireSession();
    const { returnTo } = await request.json();

    const state = JSON.stringify({ userId: user.id, returnTo: returnTo || '/' });
    const authUrl = getGoogleAuthUrl(Buffer.from(state).toString('base64'));

    return NextResponse.json({ authUrl });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
