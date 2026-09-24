import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { query, insert } from '@/lib/db.js';
import { getChannelAccess } from '@/lib/channels.js';
import { getTokenWithScope, getGoogleAuthUrl, CALENDAR_SCOPE } from '@/lib/gdrive.js';
import { createMeetEvent } from '@/lib/google-meet.js';
import { sanitizeString, rateLimit } from '@/lib/security.js';

/**
 * Start (now) or schedule a Google Meet for this conversation and post it as a card.
 * Body: { title?, start? (ISO), durationMinutes?, invite? (send calendar invites to members), timeZone? }
 * If Google Calendar isn't connected yet, returns { needsGoogle: true, authUrl }.
 */
export async function POST(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const access = await getChannelAccess(id, user);
  if (!access?.isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  if (!rateLimit(`meet:${user.id}`, 10, 60000)) return NextResponse.json({ error: 'Slow down' }, { status: 429 });

  const b = await request.json().catch(() => ({}));
  const ch = access.channel;
  const google = await getTokenWithScope(user.id, CALENDAR_SCOPE);
  if (!google?.hasScope) {
    const state = Buffer.from(JSON.stringify({ userId: user.id, returnTo: `/${ch.tenant_slug}/c/${ch.id}?meet=1` })).toString('base64');
    return NextResponse.json({ needsGoogle: true, authUrl: getGoogleAuthUrl(state, [CALENDAR_SCOPE]) });
  }

  const title = sanitizeString(b.title, 200) || (ch.is_dm ? `Call with ${user.name || user.email}` : `#${ch.name} meeting`);
  const start = b.start && !Number.isNaN(Date.parse(b.start)) ? new Date(b.start) : null;
  const duration = Math.min(Math.max(Number(b.durationMinutes) || 30, 15), 480);
  const attendees = b.invite
    ? (await query('SELECT u.email FROM channel_members cm JOIN users u ON u.id = cm.user_id WHERE cm.channel_id = ? AND u.id <> ?', [ch.id, user.id]))
        .map((r) => r.email)
        .slice(0, 100)
    : [];

  try {
    const meet = await createMeetEvent(google.accessToken, {
      title,
      start,
      durationMinutes: duration,
      attendees,
      timeZone: typeof b.timeZone === 'string' ? b.timeZone.slice(0, 64) : undefined,
      description: `Started from AppChat — ${ch.is_dm ? 'direct message' : `#${ch.name}`}`,
    });
    const scheduled = Boolean(start && start.getTime() > Date.now() + 5 * 60000);
    const card = { kind: 'meet', title, url: meet.meetUrl, eventUrl: meet.eventUrl, start: meet.start, end: meet.end, scheduled, invited: attendees.length };
    await insert('INSERT INTO messages (channel_id, user_id, body, type, metadata) VALUES (?, ?, ?, ?, ?)', [
      ch.id,
      user.id,
      `${scheduled ? 'Scheduled' : 'Started'} a Google Meet: ${title} — ${meet.meetUrl}`,
      'text',
      JSON.stringify({ card }),
    ]);
    return NextResponse.json(card, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status === 401 ? 401 : 400 });
  }
}
