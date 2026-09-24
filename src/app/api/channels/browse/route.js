import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { query } from '@/lib/db.js';
import { requireMembership } from '@/lib/tenant.js';

// Public channels in the workspace that the viewer hasn't joined yet.
export async function GET(request) {
  const user = await requireSession().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const m = await requireMembership(request.nextUrl.searchParams.get('tenant'), user.id).catch(() => null);
  if (!m) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  const channels = await query(
    `SELECT c.id, c.name, c.description,
            (SELECT COUNT(*) FROM channel_members x WHERE x.channel_id = c.id) AS member_count
     FROM channels c
     WHERE c.tenant_id = ? AND c.is_private = 0 AND c.is_dm = 0 AND c.archived_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?)
     ORDER BY c.name`,
    [m.tenant_id, user.id]
  );
  return NextResponse.json({ channels });
}
