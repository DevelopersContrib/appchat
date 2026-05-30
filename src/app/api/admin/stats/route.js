import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin.js';
import { queryOne, query } from '@/lib/db.js';

export async function GET() {
  try {
    await requireAdmin();

    const [tenants, users, channels, messages, rooms, activeRooms] = await Promise.all([
      queryOne('SELECT COUNT(*) as count FROM tenants'),
      queryOne('SELECT COUNT(*) as count FROM users'),
      queryOne('SELECT COUNT(*) as count FROM channels'),
      queryOne('SELECT COUNT(*) as count FROM messages'),
      queryOne('SELECT COUNT(*) as count FROM rooms'),
      queryOne("SELECT COUNT(*) as count FROM rooms WHERE status IN ('waiting','active')"),
    ]);

    const recentTenants = await query(
      'SELECT id, slug, name, created_at FROM tenants ORDER BY created_at DESC LIMIT 5'
    );

    const recentUsers = await query(
      'SELECT id, email, name, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 5'
    );

    return NextResponse.json({
      counts: {
        tenants: tenants.count,
        users: users.count,
        channels: channels.count,
        messages: messages.count,
        rooms: rooms.count,
        activeRooms: activeRooms.count,
      },
      recentTenants,
      recentUsers,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
