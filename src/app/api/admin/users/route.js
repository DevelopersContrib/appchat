import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin.js';
import { query, insert, queryOne } from '@/lib/db.js';
import { validateEmail, sanitizeString } from '@/lib/security.js';

export async function GET(request) {
  try {
    await requireAdmin();
    const search = request.nextUrl.searchParams.get('search') || '';
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = 20;
    const offset = (page - 1) * limit;

    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE u.email LIKE ? OR u.name LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    const countResult = await queryOne(`SELECT COUNT(*) as total FROM users u ${where}`, params);

    const users = await query(
      `SELECT u.*, GROUP_CONCAT(CONCAT(t.slug, ':', tm.role) SEPARATOR ', ') as tenants
       FROM users u LEFT JOIN tenant_members tm ON tm.user_id = u.id
       LEFT JOIN tenants t ON t.id = tm.tenant_id
       ${where} GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      users,
      total: countResult.total,
      page,
      pages: Math.ceil(countResult.total / limit),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function POST(request) {
  try {
    await requireAdmin();
    const { email, name, isAdmin } = await request.json();

    if (!email?.trim() || !validateEmail(email.trim())) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email.trim()]);
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const id = await insert(
      'INSERT INTO users (email, name, is_admin) VALUES (?, ?, ?)',
      [email.trim(), name || '', isAdmin ? 1 : 0]
    );

    return NextResponse.json({ id, email: email.trim() }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
