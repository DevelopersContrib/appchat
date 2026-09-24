import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db.js';
import { getDebrief, postDebrief, debriefTargets, isLoopAgentConfigured } from '@/lib/loopagent.js';

// Daily (vercel.json): post the latest LoopAgent debrief into each workspace's chosen channel.
export async function GET(request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isLoopAgentConfigured()) return NextResponse.json({ skipped: 'LoopAgent not connected' });
  const debrief = await getDebrief();
  if (!debrief) return NextResponse.json({ skipped: 'no debrief yet' });

  let posted = 0;
  for (const t of await debriefTargets()) {
    const ch = await queryOne('SELECT id FROM channels WHERE id = ? AND tenant_id = ? AND archived_at IS NULL', [t.channel_id, t.id]);
    if (ch && (await postDebrief(ch.id, debrief))) posted++;
  }
  return NextResponse.json({ date: debrief.date, posted });
}
