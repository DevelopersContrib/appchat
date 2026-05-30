import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin.js';
import { searchVnocDomains, getVnocDomainCount } from '@/lib/domains.js';

export async function GET(request) {
  try {
    await requireAdmin();
    const search = request.nextUrl.searchParams.get('search') || '';
    const total = await getVnocDomainCount();
    const domains = search ? await searchVnocDomains(search, 50) : await searchVnocDomains('', 50);
    return NextResponse.json({ domains, total });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
