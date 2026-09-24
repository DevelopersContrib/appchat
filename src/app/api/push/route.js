import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query } from '@/lib/db.js';
import { isPushConfigured } from '@/lib/push.js';

// Public key the browser needs to subscribe.
export async function GET() {
  return NextResponse.json({ publicKey: isPushConfigured() ? process.env.VAPID_PUBLIC_KEY : null });
}

// Save this device's push subscription.
export async function POST(request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { subscription } = await request.json().catch(() => ({}));
  const endpoint = subscription?.endpoint;
  const { p256dh, auth } = subscription?.keys || {};
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 700 || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [user.id, endpoint, String(p256dh).slice(0, 255), String(auth).slice(0, 255), (request.headers.get('user-agent') || '').slice(0, 255)]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { endpoint } = await request.json().catch(() => ({}));
  await query('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [user.id, String(endpoint || '')]);
  return NextResponse.json({ ok: true });
}
