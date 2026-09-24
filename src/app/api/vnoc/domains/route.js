import { NextResponse } from 'next/server';
import { withVnoc } from '@/lib/vnoc-route.js';
import { searchDomains } from '@/lib/vnoc.js';

export const GET = withVnoc(async (request, { access }) => {
  const q = request.nextUrl.searchParams.get('q') || '';
  if (q.trim().length < 2) return NextResponse.json({ domains: [], isAdmin: access.isAdmin });
  return NextResponse.json({ domains: await searchDomains(access, q), isAdmin: access.isAdmin });
});
