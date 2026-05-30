import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { unfurlUrl } from '@/lib/unfurl.js';
import { rateLimit, getClientIp, sanitizeUrl } from '@/lib/security.js';

export async function POST(request) {
  try {
    const user = await requireSession();
    const ip = getClientIp(request);

    if (!rateLimit(`unfurl:${user.id}`, 20, 60000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { url } = await request.json();
    const safeUrl = sanitizeUrl(url);

    if (!safeUrl) {
      return NextResponse.json({ error: 'Invalid or blocked URL' }, { status: 400 });
    }

    const preview = await unfurlUrl(safeUrl);
    if (!preview) {
      return NextResponse.json({ error: 'Could not fetch preview' }, { status: 404 });
    }

    return NextResponse.json(preview);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
