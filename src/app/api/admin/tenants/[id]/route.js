import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin.js';
import { query, queryOne } from '@/lib/db.js';

export async function GET(request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const tenant = await queryOne(
      `SELECT t.*, p.name as plan_name FROM tenants t LEFT JOIN plans p ON p.id = t.plan_id WHERE t.id = ?`,
      [id]
    );
    if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const members = await query(
      `SELECT tm.*, u.email, u.name as user_name, u.is_admin FROM tenant_members tm
       JOIN users u ON u.id = tm.user_id WHERE tm.tenant_id = ?`,
      [id]
    );

    const channels = await query('SELECT * FROM channels WHERE tenant_id = ? ORDER BY name', [id]);
    const rooms = await query('SELECT * FROM rooms WHERE tenant_id = ? ORDER BY started_at DESC LIMIT 20', [id]);

    return NextResponse.json({ tenant, members, channels, rooms });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function PUT(request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { name, slug, domain, logoUrl, brandColor, planId, crmWebhookUrl, settings } = await request.json();

    await query(
      `UPDATE tenants SET name = ?, slug = ?, domain = ?, logo_url = ?, brand_color = ?,
       plan_id = ?, crm_webhook_url = ?, settings = ? WHERE id = ?`,
      [name, slug, domain || null, logoUrl, brandColor, planId || 1, crmWebhookUrl || null, settings ? JSON.stringify(settings) : null, id]
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
    await query('DELETE FROM tenants WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
