import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin.js';
import { query } from '@/lib/db.js';

export async function DELETE(request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await query('DELETE FROM brand_knowledge WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
