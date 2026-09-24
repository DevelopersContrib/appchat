import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { createApiToken, listApiTokens, revokeApiToken } from '@/lib/api-tokens.js';
import { rateLimit, sanitizeString } from '@/lib/security.js';

// Personal connection keys for AI assistants (Settings → Connect Claude / ChatGPT).
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ tokens: await listApiTokens(user.id) });
}

export async function POST(request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!rateLimit(`token:${user.id}`, 10, 3600000)) return NextResponse.json({ error: 'Too many keys created' }, { status: 429 });
  const { name } = await request.json().catch(() => ({}));
  const token = await createApiToken(user.id, sanitizeString(name, 100) || 'AI assistant');
  return NextResponse.json({ token }, { status: 201 });
}

export async function DELETE(request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await revokeApiToken(user.id, Number(request.nextUrl.searchParams.get('id')));
  return NextResponse.json({ ok: true });
}
