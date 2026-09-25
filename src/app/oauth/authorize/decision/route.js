import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { createAuthCode } from '@/lib/oauth.js';
import { parseAuthRequest, withParams } from '@/lib/oauth-request.js';

// The user clicked Allow or Cancel on the approval screen.
export async function POST(request) {
  // Only our own approval page may post here.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const user = await getSession();
  if (!user) return NextResponse.redirect(new URL('/login', request.url), 303);

  const form = Object.fromEntries((await request.formData()).entries());
  const req = await parseAuthRequest({ ...form, code_challenge_method: 'S256' });
  if (req.error && !req.redirectUri) return NextResponse.json({ error: req.error }, { status: 400 });

  if (form.decision !== 'allow') {
    return NextResponse.redirect(withParams(req.redirectUri, { error: 'access_denied', state: req.state }), 303);
  }
  const code = await createAuthCode({ clientId: req.client.client_id, userId: user.id, redirectUri: req.redirectUri, codeChallenge: req.codeChallenge });
  return NextResponse.redirect(withParams(req.redirectUri, { code, state: req.state }), 303);
}
