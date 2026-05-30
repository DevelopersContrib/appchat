import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin.js';
import { query, queryOne } from '@/lib/db.js';

export async function PUT(request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { status, name } = await request.json();

    const sets = [];
    const vals = [];
    if (status) { sets.push('status = ?'); vals.push(status); }
    if (status === 'ended') { sets.push('ended_at = NOW()'); }
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }

    if (sets.length) {
      vals.push(id);
      await query(`UPDATE rooms SET ${sets.join(', ')} WHERE id = ?`, vals);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await query('DELETE FROM rooms WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
