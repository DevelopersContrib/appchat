import { NextResponse } from 'next/server';

export async function POST(request) {
  // Block cross-site forms from signing people out.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const res = NextResponse.redirect(new URL('/login', request.url), 303);
  res.cookies.delete('appchat_session');
  return res;
}
