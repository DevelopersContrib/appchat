import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin.js';
import { query, insert } from '@/lib/db.js';
import { indexWebsite, indexDriveDoc } from '@/lib/brand-context.js';
import { getValidToken } from '@/lib/gdrive.js';

export async function GET(request) {
  try {
    await requireAdmin();
    const tenantId = request.nextUrl.searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const knowledge = await query(
      `SELECT bk.*, tw.label as website_label
       FROM brand_knowledge bk
       LEFT JOIN tenant_websites tw ON tw.url = bk.source_url AND tw.tenant_id = bk.tenant_id
       WHERE bk.tenant_id = ?
       ORDER BY bk.last_synced_at DESC`,
      [tenantId]
    );

    const websites = await query(
      'SELECT * FROM tenant_websites WHERE tenant_id = ? ORDER BY created_at',
      [tenantId]
    );

    return NextResponse.json({ knowledge, websites });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function POST(request) {
  try {
    const admin = await requireAdmin();
    const { tenantId, action, url, label, title, content, fileId, fileName } = await request.json();

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    if (action === 'add_website') {
      await insert(
        'INSERT INTO tenant_websites (tenant_id, url, label) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE label = ?',
        [tenantId, url, label || '', label || '']
      );
      const result = await indexWebsite(tenantId, url);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'crawl_website') {
      const result = await indexWebsite(tenantId, url);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'index_gdrive') {
      const accessToken = await getValidToken(admin.id);
      if (!accessToken) {
        return NextResponse.json({ error: 'Google Drive not connected', needsAuth: true }, { status: 401 });
      }
      const result = await indexDriveDoc(tenantId, accessToken, fileId, fileName);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'add_manual') {
      await insert(
        'INSERT INTO brand_knowledge (tenant_id, source_type, title, content) VALUES (?, ?, ?, ?)',
        [tenantId, 'manual', title, content]
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
