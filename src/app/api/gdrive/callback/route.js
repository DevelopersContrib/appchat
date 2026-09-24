import { NextResponse } from 'next/server';
import { exchangeCode, saveToken } from '@/lib/gdrive.js';
import { getSession } from '@/lib/auth.js';

export async function GET(request) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const stateB64 = request.nextUrl.searchParams.get('state');

    if (!code || !stateB64) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const state = JSON.parse(Buffer.from(stateB64, 'base64').toString());
    // Link Google to whoever is actually signed in — never to a user id taken from the URL.
    const user = await getSession();
    if (!user || (state.userId && Number(state.userId) !== user.id)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    const tokenData = await exchangeCode(code);

    if (tokenData.error) {
      return NextResponse.redirect(new URL('/?error=gdrive_auth_failed', request.url));
    }

    await saveToken(user.id, tokenData);

    let returnTo = state.returnTo || '/';
    if (!returnTo.startsWith('/') || returnTo.startsWith('//')) returnTo = '/';

    return NextResponse.redirect(new URL(returnTo, request.url));
  } catch (err) {
    return NextResponse.redirect(new URL('/?error=gdrive_callback_failed', request.url));
  }
}
