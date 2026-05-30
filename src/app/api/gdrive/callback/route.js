import { NextResponse } from 'next/server';
import { exchangeCode, saveToken } from '@/lib/gdrive.js';

export async function GET(request) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const stateB64 = request.nextUrl.searchParams.get('state');

    if (!code || !stateB64) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const state = JSON.parse(Buffer.from(stateB64, 'base64').toString());
    const tokenData = await exchangeCode(code);

    if (tokenData.error) {
      return NextResponse.redirect(new URL('/?error=gdrive_auth_failed', request.url));
    }

    await saveToken(state.userId, tokenData);

    let returnTo = state.returnTo || '/';
    if (!returnTo.startsWith('/') || returnTo.startsWith('//')) returnTo = '/';

    return NextResponse.redirect(new URL(returnTo, request.url));
  } catch (err) {
    return NextResponse.redirect(new URL('/?error=gdrive_callback_failed', request.url));
  }
}
