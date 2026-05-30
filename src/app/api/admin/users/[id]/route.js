import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin.js';
import { query, queryOne } from '@/lib/db.js';

export async function GET(request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const memberships = await query(
      `SELECT tm.*, t.name as tenant_name, t.slug as tenant_slug
       FROM tenant_members tm JOIN tenants t ON t.id = tm.tenant_id WHERE tm.user_id = ?`,
      [id]
    );

    return NextResponse.json({ user, memberships });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function PUT(request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { name, email, isAdmin } = await request.json();

    await query(
      'UPDATE users SET name = ?, email = ?, is_admin = ? WHERE id = ?',
      [name, email, isAdmin ? 1 : 0, id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await query('DELETE FROM users WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
