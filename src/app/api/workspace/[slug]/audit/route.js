import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { withWorkspaceAdmin } from '@/lib/workspace.js';

export const GET = withWorkspaceAdmin(async (request, { tenant }) => {
  const rows = await query(
    `SELECT a.id, a.action, a.target, a.details, a.created_at, u.name AS actor_name, u.email AS actor_email
     FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.tenant_id = ? ORDER BY a.id DESC LIMIT 200`,
    [tenant.id]
  );
  return NextResponse.json({ entries: rows });
});
