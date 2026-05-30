import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';

export async function GET() {
  try {
    const rooms = await query(
      `SELECT r.id, r.name, r.livekit_room, r.status, r.started_at,
              t.name as tenant_name, t.slug as tenant_slug, t.logo_url,
              u.name as creator_name,
              (SELECT COUNT(*) FROM room_participants rp WHERE rp.room_id = r.id AND rp.left_at IS NULL) as participant_count
       FROM rooms r
       JOIN tenants t ON t.id = r.tenant_id
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.status IN ('waiting', 'active')
       ORDER BY r.started_at DESC
       LIMIT 6`
    );

    return NextResponse.json(rooms);
  } catch (err) {
    return NextResponse.json([], { status: 200 });
  }
}
