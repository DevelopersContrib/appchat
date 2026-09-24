import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { tenantSlugForHost, isPlatformHost } from './lib/hosts.js';

// /api/mcp authenticates with a personal connection key (Bearer), not the session cookie.
const PUBLIC_PATHS = ['/', '/login', '/join', '/about', '/contact', '/privacy', '/terms', '/api/auth', '/api/rooms/public', '/api/cron', '/api/mcp'];
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Paths that are shared app routes, not tenant pages; never prefix these with a tenant slug.
const SHARED_PREFIXES = ['/api', '/login', '/join', '/room', '/_next', '/admin', '/dashboard', '/onboard', '/.well-known', '/pwa'];
// Static/PWA files (manifest, service worker, icons) must load without a session.
const PUBLIC_FILES = ['/manifest.webmanifest', '/sw.js', '/offline.html', '/icon.svg', '/pwa-icon.svg', '/robots.txt'];
const isFile = (pathname) =>
  PUBLIC_FILES.includes(pathname) || pathname.startsWith('/pwa/') || pathname.startsWith('/.well-known/');

// host -> { slug, at }. Per edge instance; entries refresh after a minute so domain changes apply quickly.
const hostCache = new Map();
const HOST_CACHE_MS = 60000;

async function lookupHostTenant(request, host) {
  const fromEnv = tenantSlugForHost(host);
  if (fromEnv || isPlatformHost(host)) return fromEnv;
  const hit = hostCache.get(host);
  if (hit && Date.now() - hit.at < HOST_CACHE_MS) return hit.slug;
  try {
    const url = new URL('/api/hosts/resolve', request.nextUrl.origin);
    url.searchParams.set('host', host);
    const res = await fetch(url, { cache: 'no-store' });
    const { slug } = res.ok ? await res.json() : { slug: null };
    hostCache.set(host, { slug: slug || null, at: Date.now() });
    return slug || null;
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();

  // The lookup endpoint itself must never be routed through a workspace.
  if (pathname === '/api/hosts/resolve') return NextResponse.next();

  const hostTenant = await lookupHostTenant(request, host);
  if (hostTenant) {
    return handleTenantHost(request, hostTenant);
  }

  const subdomain = extractSubdomain(host);
  if (subdomain && !isShared(pathname) && !isFile(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${subdomain}${pathname}`;
    const res = NextResponse.rewrite(url);
    res.headers.set('x-tenant-slug', subdomain);
    return res;
  }

  if (isFile(pathname) || PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/room/')) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter(Boolean);
  const isDomainPage = segments.length === 1 && !['admin', 'onboard', 'select-org', 'dashboard'].includes(segments[0]);
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

function isShared(pathname) {
  return SHARED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

async function handleTenantHost(request, slug) {
  const { pathname } = request.nextUrl;
  // Private workspace host: everything needs a session; tenant membership is checked in [tenant]/layout.
  const isPublic = pathname === '/login' || pathname.startsWith('/join/') || pathname.startsWith('/api/auth/') || pathname === '/api/mcp' || isFile(pathname);

  if (!isPublic) {
    const token = request.cookies.get('appchat_session')?.value;
    let payload = null;
    if (token) {
      try {
        ({ payload } = await jwtVerify(token, JWT_SECRET));
      } catch {}
    }
    if (pathname.startsWith('/admin') && payload && !payload.isAdmin) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (!payload) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const res = NextResponse.redirect(new URL('/login', request.url));
      if (token) res.cookies.delete('appchat_session');
      return res;
    }
  }

  // Sidebar links are already tenant-prefixed (/vnoc/c/1); only bare paths need rewriting.
  if (isPublic || isShared(pathname) || pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname === '/' ? `/${slug}` : `/${slug}${pathname}`;
  const res = NextResponse.rewrite(url);
  res.headers.set('x-tenant-slug', slug);
  return res;
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
