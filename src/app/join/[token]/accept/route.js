import { NextResponse } from 'next/server';
import { findInvite, INVITE_COOKIE } from '@/lib/invites.js';

// Remember the invite for 1 hour and go sign in; the login callback completes the join.
export async function POST(request, { params }) {
  const { token } = await params;
  const invite = await findInvite(token);
  const res = NextResponse.redirect(new URL(invite ? '/login?invite=1' : `/join/${token}`, request.url), 303);
  if (invite) {
    res.cookies.set(INVITE_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 3600, path: '/' });
  }
  return res;
}
