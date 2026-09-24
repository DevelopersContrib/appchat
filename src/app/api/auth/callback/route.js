import { NextResponse } from 'next/server';
import { authenticateWithMagic } from '@/lib/auth.js';
import { rateLimit, getClientIp } from '@/lib/security.js';
import { resolveTenantSlugForHost } from '@/lib/tenant-host.js';
import { syncContribProfile } from '@/lib/contrib.js';
import { findInvite, acceptInvite, INVITE_COOKIE } from '@/lib/invites.js';

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

    // Arriving from an invite link lets someone new sign in; they're added to that workspace.
    const invite = await findInvite(request.cookies.get(INVITE_COOKIE)?.value);
    const { user, token } = await authenticateWithMagic(didToken, { membersOnly: !invite });
    // Pull name and photo from the person's contrib.com profile.
    await syncContribProfile(user);

    let redirectTo = (await resolveTenantSlugForHost(request.headers.get('host'))) ? '/' : '/dashboard';
    if (invite) redirectTo = (await acceptInvite(invite, user.id)).url;

    const res = NextResponse.json({ user: { id: user.id, email: user.email }, redirectTo });
    res.cookies.set('appchat_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    if (invite) res.cookies.delete(INVITE_COOKIE);

    return res;
  } catch (err) {
    const isForbidden = err?.message === 'Admin access required' || err?.message === 'Not a team member';
    return NextResponse.json(
      { error: isForbidden ? 'This email has not been invited. Ask an admin to add you.' : 'Authentication failed' },
      { status: isForbidden ? 403 : 401 }
    );
  }
}

