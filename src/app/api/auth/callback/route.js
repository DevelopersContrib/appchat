import { NextResponse } from 'next/server';
import { authenticateWithMagic } from '@/lib/auth.js';
import { rateLimit, getClientIp } from '@/lib/security.js';

export async function POST(request) {
  const ip = getClientIp(request);
  if (!rateLimit(`auth:${ip}`, 5, 60000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  try {
    const { didToken } = await request.json();
    if (!didToken || typeof didToken !== 'string') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const { user, token } = await authenticateWithMagic(didToken, { adminOnly: true });

    const redirectTo = '/dashboard';

    const res = NextResponse.json({ user: { id: user.id, email: user.email }, redirectTo });
    res.cookies.set('appchat_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return res;
  } catch (err) {
    const isForbidden = err?.message === 'Admin access required';
    return NextResponse.json(
      { error: isForbidden ? 'Admin access required' : 'Authentication failed' },
      { status: isForbidden ? 403 : 401 }
    );
  }
}
