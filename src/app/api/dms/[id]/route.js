import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query } from '@/lib/db.js';

// Close a DM for the viewer only. History is kept; it reopens when a new message arrives or they message again.
export async function DELETE(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const res = await query(
    `UPDATE channel_members cm JOIN channels c ON c.id = cm.channel_id
     SET cm.hidden_at = NOW()
     WHERE cm.channel_id = ? AND cm.user_id = ? AND c.is_dm = 1`,
    [id, user.id]
  );
  if (!res.affectedRows) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
