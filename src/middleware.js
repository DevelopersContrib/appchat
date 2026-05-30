import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/', '/login', '/about', '/contact', '/privacy', '/terms', '/api/auth', '/api/rooms/public'];
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';

  const subdomain = extractSubdomain(host);
  if (subdomain) {
    const url = request.nextUrl.clone();
    url.pathname = `/${subdomain}${pathname}`;
    const res = NextResponse.rewrite(url);
    res.headers.set('x-tenant-slug', subdomain);
    return res;
  }

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/room/')) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter(Boolean);
  const isDomainPage = segments.length === 1 && !['admin', 'onboard', 'select-org'].includes(segments[0]);
  if (isDomainPage) {
    return NextResponse.next();
  }

  const token = request.cookies.get('appchat_session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (pathname.startsWith('/admin')) {
      if (!payload.isAdmin) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL('/login', request.url));
    res.cookies.delete('appchat_session');
    return res;
  }
}

function extractSubdomain(host) {
  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0];
    if (['www', 'appchat', 'localhost'].includes(sub)) return null;
    return sub;
  }
  return null;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml).*)'],
};
