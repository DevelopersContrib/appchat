import { headers } from 'next/headers';
import { getTenantBySlug } from '@/lib/tenant.js';
import { resolveTenantSlugForHost } from '@/lib/tenant-host.js';

// Installable app manifest. White-label workspace hosts (TENANT_HOSTS) install as their own branded app.
export async function GET() {
  const host = (await headers()).get('host') || '';
  const slug = await resolveTenantSlugForHost(host);
  const tenant = slug ? await getTenantBySlug(slug).catch(() => null) : null;

  const manifest = {
    id: '/',
    name: tenant ? tenant.name : 'AppChat',
    short_name: tenant ? tenant.name.slice(0, 12) : 'AppChat',
    description: tenant
      ? `${tenant.name} team chat, video calls, and AI agents.`
      : 'Secure chat, video calls, and AI agents for your team.',
    start_url: tenant ? '/' : '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#0a0a0f',
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  });
}
