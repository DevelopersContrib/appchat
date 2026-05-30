import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin.js';
import { queryOne, query } from '@/lib/db.js';
import { parseTenantSettings, resolveToneProfile } from '@/lib/brand-agent-profiles.js';

export async function GET(request) {
  try {
    await requireAdmin();
    const tenantSlug = request.nextUrl.searchParams.get('tenant');
    if (!tenantSlug) {
      return NextResponse.json({ error: 'tenant is required' }, { status: 400 });
    }

    const tenant = await queryOne('SELECT id, slug, settings FROM tenants WHERE slug = ?', [tenantSlug]);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const settings = parseTenantSettings(tenant.settings);
    const tone = resolveToneProfile(settings.brandAgentTone || 'consultative');

    return NextResponse.json({ tenant: tenant.slug, toneProfile: tone.id, toneLabel: tone.label });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

export async function POST(request) {
  try {
    await requireAdmin();
    const { tenantSlug, toneProfile } = await request.json();
    if (!tenantSlug || !toneProfile) {
      return NextResponse.json({ error: 'tenantSlug and toneProfile are required' }, { status: 400 });
    }

    const tenant = await queryOne('SELECT id, settings FROM tenants WHERE slug = ?', [tenantSlug]);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const tone = resolveToneProfile(toneProfile);
    const settings = parseTenantSettings(tenant.settings);
    settings.brandAgentTone = tone.id;

    await query('UPDATE tenants SET settings = ? WHERE id = ?', [JSON.stringify(settings), tenant.id]);

    return NextResponse.json({ ok: true, tenant: tenantSlug, toneProfile: tone.id, toneLabel: tone.label });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
