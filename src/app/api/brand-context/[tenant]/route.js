import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { getTenantBySlug, requireMembership } from '@/lib/tenant.js';
import { getBrandContext } from '@/lib/brand-context.js';

export async function GET(request, { params }) {
  try {
    const user = await requireSession();
    const { tenant: slug } = await params;

    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    await requireMembership(slug, user.id);

    const context = await getBrandContext(tenant.id, slug);

    return NextResponse.json(context);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
