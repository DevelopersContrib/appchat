import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { queryOne, query } from '@/lib/db.js';
import { generateClaudeAgentReply } from '@/lib/claude-agent.js';
import { buildBrandAgentReply } from '@/lib/brand-agent.js';
import { parseTenantSettings, resolveToneProfile } from '@/lib/brand-agent-profiles.js';
import { sanitizeString } from '@/lib/security.js';

export async function POST(request) {
  try {
    await requireSession();
    const { room, message, sender } = await request.json();

    const roomName = sanitizeString(room, 255);
    const userMessage = sanitizeString(message, 2000);
    const senderName = sanitizeString(sender, 120);
    if (!roomName || !userMessage) {
      return NextResponse.json({ error: 'room and message are required' }, { status: 400 });
    }

    const roomRow = await queryOne(
      `SELECT r.id, r.livekit_room, r.channel_id, t.domain as brand_domain, t.slug as tenant_slug, t.settings as tenant_settings
       FROM rooms r
       JOIN tenants t ON t.id = r.tenant_id
       WHERE r.livekit_room = ?
       LIMIT 1`,
      [roomName]
    );

    if (!roomRow || !roomRow.channel_id) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const latestAgentContext = await queryOne(
      `SELECT metadata FROM messages
       WHERE channel_id = ? AND type = 'ai'
       ORDER BY id DESC
       LIMIT 1`,
      [roomRow.channel_id]
    );

    let context = {};
    try {
      context = latestAgentContext?.metadata
        ? (typeof latestAgentContext.metadata === 'string'
            ? JSON.parse(latestAgentContext.metadata)
            : latestAgentContext.metadata)
        : {};
    } catch {
      context = {};
    }

    const recentRows = await query(
      `SELECT m.body, m.type, u.name as author_name, u.email as author_email
       FROM messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = ?
         AND m.body IS NOT NULL
         AND m.body != ''
       ORDER BY m.id DESC
       LIMIT 12`,
      [roomRow.channel_id]
    );
    const recentMessages = recentRows.reverse().map((row) => ({
      role: row.type === 'ai' ? 'assistant' : 'user',
      content: row.type === 'ai' ? row.body : `${row.author_name || row.author_email || 'User'}: ${row.body}`,
    }));

    const tenantSettings = parseTenantSettings(roomRow.tenant_settings);
    const toneProfile = context.toneProfile || tenantSettings.brandAgentTone || 'consultative';
    const tone = resolveToneProfile(toneProfile);
    const brandDomain = context.brandDomain || roomRow.brand_domain || `${roomRow.tenant_slug}.com`;

    let reply = await generateClaudeAgentReply({
      latestUserMessage: userMessage,
      recentMessages,
      meetingAbout: context.meetingAbout,
      expectedAttendees: context.expectedAttendees,
      expectedContributions: context.expectedContributions,
      brandDomain,
      toneProfile: tone.id,
    });

    if (!reply) {
      reply = buildBrandAgentReply({
        messageBody: userMessage,
        meetingAbout: context.meetingAbout,
        expectedAttendees: context.expectedAttendees,
        expectedContributions: context.expectedContributions,
        senderName: senderName || 'team',
        toneProfile: tone.id,
      });
    }

    return NextResponse.json({ reply: reply || '' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
