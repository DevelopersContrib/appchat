import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin.js';
import { query } from '@/lib/db.js';

export async function GET() {
  try {
    await requireAdmin();
    const plans = await query('SELECT * FROM plans ORDER BY price_cents ASC');
    return NextResponse.json(plans);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function PUT(request) {
  try {
    await requireAdmin();
    const { id, priceCents, includedRoomMinutes, includedAiMinutes, includedMessages, maxMembers, maxChannels } = await request.json();

    await query(
      `UPDATE plans SET price_cents = ?, included_room_minutes = ?, included_ai_minutes = ?,
       included_messages = ?, max_members = ?, max_channels = ? WHERE id = ?`,
      [priceCents, includedRoomMinutes, includedAiMinutes, includedMessages, maxMembers, maxChannels, id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
