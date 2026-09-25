import { NextResponse } from 'next/server';

// Remember where to come back to (the approval screen) and go sign in.
export function GET(request) {
  const next = request.nextUrl.searchParams.get('next') || '';
  const res = NextResponse.redirect(new URL('/login', request.url));
  if (next.startsWith('/oauth/authorize')) {
    res.cookies.set('appchat_next', next, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 900, path: '/' });
  }
  return res;
}
