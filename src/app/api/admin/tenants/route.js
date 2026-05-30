import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin.js';
import { query, insert, queryOne } from '@/lib/db.js';

export async function GET(request) {
  try {
    await requireAdmin();
    const search = request.nextUrl.searchParams.get('search') || '';
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = 20;
    const offset = (page - 1) * limit;

    let sql = `SELECT t.*, p.name as plan_name,
               (SELECT COUNT(*) FROM tenant_members tm WHERE tm.tenant_id = t.id) as member_count,
               (SELECT COUNT(*) FROM channels c WHERE c.tenant_id = t.id) as channel_count
               FROM tenants t LEFT JOIN plans p ON p.id = t.plan_id`;
    const params = [];

    if (search) {
      sql += ' WHERE t.name LIKE ? OR t.slug LIKE ? OR t.domain LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countResult = await queryOne(
      `SELECT COUNT(*) as total FROM tenants${search ? ' WHERE name LIKE ? OR slug LIKE ? OR domain LIKE ?' : ''}`,
      search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []
    );

    sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const tenants = await query(sql, params);

    return NextResponse.json({
      tenants,
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
    const { name, slug, domain, logoUrl, brandColor, planId } = await request.json();

    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json({ error: 'Name and slug required' }, { status: 400 });
    }

    const existing = await queryOne('SELECT id FROM tenants WHERE slug = ?', [slug]);
    if (existing) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }

    const id = await insert(
      'INSERT INTO tenants (slug, name, domain, logo_url, brand_color, plan_id) VALUES (?, ?, ?, ?, ?, ?)',
      [slug, name.trim(), domain || null, logoUrl || `https://www.brandidentity.com/logo/${slug}.com`, brandColor || '#d63031', planId || 1]
    );

    const channelId = await insert(
      'INSERT INTO channels (tenant_id, name, description) VALUES (?, ?, ?)',
      [id, 'general', 'General discussion']
    );

    return NextResponse.json({ id, slug }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
