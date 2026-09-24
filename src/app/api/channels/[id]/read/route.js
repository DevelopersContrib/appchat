import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query } from '@/lib/db.js';

export async function POST(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await query('UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = ? AND user_id = ?', [id, user.id]);
  return NextResponse.json({ ok: true });
}
