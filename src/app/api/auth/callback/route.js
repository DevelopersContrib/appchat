import { NextResponse } from 'next/server';
import { authenticateWithMagic } from '@/lib/auth.js';
import { getUserTenants } from '@/lib/tenant.js';

export async function POST(request) {
  try {
    const { didToken } = await request.json();
    const { user, token } = await authenticateWithMagic(didToken);

    const tenants = await getUserTenants(user.id);
    const redirectTo = tenants.length === 1
      ? `/${tenants[0].slug}`
      : tenants.length > 1
        ? '/select-org'
        : '/onboard';

    const res = NextResponse.json({ user, redirectTo });
    res.cookies.set('appchat_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return res;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
