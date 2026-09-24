import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { searchMessages } from '@/lib/search.js';

/**
 * GET /api/search?tenant=slug&q=...&type=messages|files&channelId=&fromId=&sort=relevant|recent
 * Only searches conversations the viewer is a member of.
 */
export async function GET(request) {
  const user = await requireSession().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  try {
    const results = await searchMessages(user, {
      tenantSlug: sp.get('tenant'),
      q: sp.get('q'),
      type: sp.get('type'),
      channelId: sp.get('channelId'),
      fromId: sp.get('fromId'),
      sort: sp.get('sort'),
    });
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 400 });
  }
}
