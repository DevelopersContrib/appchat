import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query } from '@/lib/db.js';

// "I'm typing" ping (the composer sends one every few seconds while typing).
export async function POST(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await query(
    `INSERT INTO user_presence (user_id, typing_channel_id, typing_at, updated_at)
     SELECT ?, ?, NOW(3), NOW() FROM channel_members WHERE channel_id = ? AND user_id = ?
     ON DUPLICATE KEY UPDATE typing_channel_id = VALUES(typing_channel_id), typing_at = NOW(3)`,
    [user.id, id, id, user.id]
  );
  return NextResponse.json({ ok: true });
}
