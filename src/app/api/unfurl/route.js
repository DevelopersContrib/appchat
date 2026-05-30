import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { unfurlUrl } from '@/lib/unfurl.js';

export async function POST(request) {
  try {
    await requireSession();
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const preview = await unfurlUrl(url);
    if (!preview) {
      return NextResponse.json({ error: 'Could not fetch preview' }, { status: 404 });
    }

    return NextResponse.json(preview);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
