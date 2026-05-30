import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { queryOne, insert } from '@/lib/db.js';
import { parseTenantSettings, resolveToneProfile } from '@/lib/brand-agent-profiles.js';

export async function POST(request, { params }) {
  try {
    const user = await requireSession();
    const { id: channelId } = await params;
    const tenantRow = await queryOne(
      `SELECT t.domain, t.slug, t.settings
       FROM channels c
       JOIN tenants t ON t.id = c.tenant_id
       WHERE c.id = ?
       LIMIT 1`,
      [channelId]
    );
    const brandDomain = tenantRow?.domain || `${tenantRow?.slug || 'appchat'}.com`;
    const brandLogo = `https://www.brandidentity.com/logo/${brandDomain}`;
    const tenantSettings = parseTenantSettings(tenantRow?.settings);
    const tone = resolveToneProfile(tenantSettings.brandAgentTone || 'consultative');


    const isMember = await queryOne(
      'SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, user.id]
    );
    if (!isMember) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    const recentAi = await queryOne(
      `SELECT id FROM messages
       WHERE channel_id = ? AND type = 'ai'
         AND created_at >= DATE_SUB(NOW(), INTERVAL 6 HOUR)
       ORDER BY id DESC
       LIMIT 1`,
      [channelId]
    );

    if (!recentAi) {
      await insert(
        'INSERT INTO messages (channel_id, user_id, body, type, metadata) VALUES (?, ?, ?, ?, ?)',
        [
          channelId,
          null,
          'Brand Agent is now present in this room. Share the meeting goal, expected attendees, and expected contributions to start a guided session.',
          'ai',
          JSON.stringify({ agentStatus: 'online', source: 'channel_onset', brandDomain, brandLogo, toneProfile: tone.id }),
        ]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
