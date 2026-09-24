import 'server-only';
import { randomUUID } from 'crypto';

/**
 * Creates a Google Calendar event with a Meet link on the user's primary calendar.
 * attendees get a calendar invite when sendUpdates is 'all'.
 */
export async function createMeetEvent(accessToken, { title, start, durationMinutes = 30, attendees = [], description = '', timeZone }) {
  const startDate = start ? new Date(start) : new Date();
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('conferenceDataVersion', '1');
  url.searchParams.set('sendUpdates', attendees.length ? 'all' : 'none');

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: title,
      description,
      start: { dateTime: startDate.toISOString(), ...(timeZone && { timeZone }) },
      end: { dateTime: endDate.toISOString(), ...(timeZone && { timeZone }) },
      attendees: attendees.map((email) => ({ email })),
      conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || `Google Calendar error ${res.status}`;
    const err = new Error(/has not been used|is disabled/i.test(msg)
      ? 'Google Calendar isn’t enabled for AppChat’s Google project yet.'
      : msg);
    err.status = res.status;
    throw err;
  }
  const meetUrl = data.hangoutLink || data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;
  if (!meetUrl) throw new Error('Google created the event but no Meet link came back');
  return { meetUrl, eventUrl: data.htmlLink, start: data.start?.dateTime, end: data.end?.dateTime };
}
