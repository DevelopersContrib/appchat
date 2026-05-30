import { NextResponse } from 'next/server';
import { authenticateWithMagic } from '@/lib/auth.js';
import { getUserTenants } from '@/lib/tenant.js';
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

    const { user, token } = await authenticateWithMagic(didToken);

    const tenants = await getUserTenants(user.id);
    const redirectTo = tenants.length === 1
      ? `/${tenants[0].slug}`
      : tenants.length > 1
        ? '/select-org'
        : '/onboard';

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
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
}
