import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { insert, queryOne, query } from '@/lib/db.js';
import { requireMembership } from '@/lib/tenant.js';
import { nanoid } from 'nanoid';
import { sanitizeString } from '@/lib/security.js';
import { parseTenantSettings, resolveToneProfile } from '@/lib/brand-agent-profiles.js';

export async function POST(request) {
  try {
    const user = await requireSession();
    const { tenant: tenantSlug, channelId, name, agentConfig } = await request.json();
    const membership = await requireMembership(tenantSlug, user.id);
    const tenantRow = await queryOne('SELECT domain, slug, settings FROM tenants WHERE id = ?', [membership.tenant_id]);
    const brandDomain = tenantRow?.domain || `${tenantRow?.slug || membership.slug}.com`;
    const brandLogo = `https://www.brandidentity.com/logo/${brandDomain}`;
    const tenantSettings = parseTenantSettings(tenantRow?.settings);
    const tone = resolveToneProfile(tenantSettings.brandAgentTone || 'consultative');
    const meetingAbout = sanitizeString(agentConfig?.meetingAbout, 500);
    const expectedAttendees = sanitizeString(agentConfig?.expectedAttendees, 500);
    const expectedContributions = sanitizeString(agentConfig?.expectedContributions, 700);

    const livekitRoom = `${membership.slug}-${nanoid(10)}`;

    const roomId = await insert(
      'INSERT INTO rooms (tenant_id, channel_id, livekit_room, name, created_by) VALUES (?, ?, ?, ?, ?)',
      [membership.tenant_id, channelId || null, livekitRoom, name || 'Quick Call', user.id]
    );

    await insert(
      'INSERT INTO room_participants (room_id, user_id, display_name) VALUES (?, ?, ?)',
      [roomId, user.id, user.name || user.email]
    );
    await insert(
      'INSERT INTO room_participants (room_id, user_id, display_name, is_agent) VALUES (?, ?, ?, ?)',
      [roomId, null, 'Brand Agent', 1]
    );

    if (channelId) {
      await insert(
        'INSERT INTO messages (channel_id, user_id, body, type, metadata) VALUES (?, ?, ?, ?, ?)',
        [channelId, user.id, `started a call: ${name || 'Quick Call'}`, 'system', JSON.stringify({ roomId, livekitRoom })]
      );

      await insert(
        'INSERT INTO messages (channel_id, user_id, body, type, metadata) VALUES (?, ?, ?, ?, ?)',
        [
          channelId,
          null,
          'Brand Agent joined the meeting and is now facilitating discussion.',
          'ai',
          JSON.stringify({
            roomId,
            livekitRoom,
            agentStatus: 'joined',
            brandDomain,
            brandLogo,
            toneProfile: tone.id,
            meetingAbout: meetingAbout || null,
            expectedAttendees: expectedAttendees || null,
            expectedContributions: expectedContributions || null,
          }),
        ]
      );

      await insert(
        'INSERT INTO messages (channel_id, user_id, body, type, metadata) VALUES (?, ?, ?, ?, ?)',
        [
          channelId,
          null,
          'To get started: what is this meeting about?',
          'ai',
          JSON.stringify({ roomId, livekitRoom, agentPrompt: 'meeting_about', brandDomain, brandLogo, toneProfile: tone.id }),
        ]
      );
      await insert(
        'INSERT INTO messages (channel_id, user_id, body, type, metadata) VALUES (?, ?, ?, ?, ?)',
        [
          channelId,
          null,
          'Who are we expecting in this meeting?',
          'ai',
          JSON.stringify({ roomId, livekitRoom, agentPrompt: 'expected_attendees', brandDomain, brandLogo, toneProfile: tone.id }),
        ]
      );
      await insert(
        'INSERT INTO messages (channel_id, user_id, body, type, metadata) VALUES (?, ?, ?, ?, ?)',
        [
          channelId,
          null,
          'What is each person expected to contribute?',
          'ai',
          JSON.stringify({ roomId, livekitRoom, agentPrompt: 'expected_contributions', brandDomain, brandLogo, toneProfile: tone.id }),
        ]
      );
    }

    return NextResponse.json({ id: roomId, livekitRoom });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function GET(request) {
  try {
    const user = await requireSession();
    const tenantSlug = request.nextUrl.searchParams.get('tenant');
    const membership = await requireMembership(tenantSlug, user.id);

    const rooms = await query(
      `SELECT r.*, u.name as creator_name,
        (SELECT COUNT(*) FROM room_participants rp WHERE rp.room_id = r.id AND rp.left_at IS NULL) as participant_count
       FROM rooms r
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.tenant_id = ? AND r.status != 'ended'
       ORDER BY r.started_at DESC`,
      [membership.tenant_id]
    );

    return NextResponse.json(rooms);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
