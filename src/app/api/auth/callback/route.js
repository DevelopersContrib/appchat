import { NextResponse } from 'next/server';
import { authenticateWithMagic } from '@/lib/auth.js';
import { rateLimit, getClientIp } from '@/lib/security.js';
import { tenantSlugForHost } from '@/lib/hosts.js';
import { syncContribProfile } from '@/lib/contrib.js';

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

    const { user, token } = await authenticateWithMagic(didToken, { membersOnly: true });
    // Pull name and photo from the person's contrib.com profile.
    await syncContribProfile(user);

    const redirectTo = tenantSlugForHost(request.headers.get('host')) ? '/' : '/dashboard';

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
    const isForbidden = err?.message === 'Admin access required' || err?.message === 'Not a team member';
    return NextResponse.json(
      { error: isForbidden ? 'This email has not been invited. Ask an admin to add you.' : 'Authentication failed' },
      { status: isForbidden ? 403 : 401 }
    );
  }
}

