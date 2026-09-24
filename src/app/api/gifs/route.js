import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { rateLimit } from '@/lib/security.js';

// GIF search via GIPHY (GIPHY_API_KEY). Returns { enabled, gifs: [{ id, title, url, preview, width, height }] }.
export async function GET(request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ enabled: false, gifs: [] });
  if (!rateLimit(`gif:${user.id}`, 60, 60000)) return NextResponse.json({ error: 'Slow down' }, { status: 429 });

  const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 50);
  const url = new URL(`https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('limit', '24');
  url.searchParams.set('rating', 'pg-13');
  if (q) url.searchParams.set('q', q);
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return NextResponse.json({ enabled: true, gifs: [], error: 'GIF search is unavailable right now' });
  const { data = [] } = await res.json();
  return NextResponse.json({
    enabled: true,
    gifs: data.map((g) => ({
      id: g.id,
      title: g.title,
      url: g.images?.fixed_height?.url || g.images?.original?.url,
      preview: g.images?.fixed_height_small?.url || g.images?.fixed_height?.url,
      width: Number(g.images?.fixed_height?.width) || null,
      height: Number(g.images?.fixed_height?.height) || null,
    })).filter((g) => g.url),
  });
}
