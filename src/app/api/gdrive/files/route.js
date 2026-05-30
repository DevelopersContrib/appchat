import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { getValidToken, listFiles } from '@/lib/gdrive.js';

export async function GET(request) {
  try {
    const user = await requireSession();
    const accessToken = await getValidToken(user.id);

    if (!accessToken) {
      return NextResponse.json({ error: 'Google Drive not connected', needsAuth: true }, { status: 401 });
    }

    const folderId = request.nextUrl.searchParams.get('folderId') || null;
    const query = request.nextUrl.searchParams.get('q') || null;
    const pageToken = request.nextUrl.searchParams.get('pageToken') || null;

    const result = await listFiles(accessToken, { folderId, query, pageToken });

    if (result.error) {
      return NextResponse.json({ error: result.error.message, needsAuth: true }, { status: 401 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
