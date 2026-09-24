import { NextResponse } from 'next/server';
import { resolveTenantSlugForHost } from '@/lib/tenant-host.js';

// Used by middleware (which can't reach the database) to map a custom domain to its workspace.
export async function GET(request) {
  const slug = await resolveTenantSlugForHost(request.nextUrl.searchParams.get('host'));
  return NextResponse.json({ slug }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
