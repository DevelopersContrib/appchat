import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query } from '@/lib/db.js';
import { requireMembership } from '@/lib/tenant.js';

// A member accepts the workspace rules (shown before entering when the workspace requires it).
export async function POST(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { slug } = await params;
  const m = await requireMembership(slug, user.id).catch(() => null);
  if (!m) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  await query('UPDATE tenant_members SET rules_accepted_at = NOW() WHERE tenant_id = ? AND user_id = ?', [m.tenant_id, user.id]);
  return NextResponse.json({ ok: true });
}
