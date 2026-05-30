import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { query, insert, queryOne } from '@/lib/db.js';
import { unfurlUrl } from '@/lib/unfurl.js';
import { rateLimit, getClientIp, sanitizeString, sanitizeUrl } from '@/lib/security.js';
import { buildBrandAgentReply } from '@/lib/brand-agent.js';
import { generateClaudeAgentReply } from '@/lib/claude-agent.js';
import { parseTenantSettings, resolveToneProfile } from '@/lib/brand-agent-profiles.js';

export async function GET(request, { params }) {
  try {
    const user = await requireSession();
    const { id: channelId } = await params;
    const after = request.nextUrl.searchParams.get('after');

    const isMember = await queryOne(
      'SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, user.id]
    );
    if (!isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    let sql = `SELECT m.*, u.name as author_name, u.email as author_email, u.avatar_url as author_avatar
               FROM messages m LEFT JOIN users u ON u.id = m.user_id
               WHERE m.channel_id = ?`;
    const params2 = [channelId];

    if (after) {
      sql += ' AND m.id > ?';
      params2.push(after);
    }

    sql += ' ORDER BY m.created_at ASC LIMIT 100';

    const messages = await query(sql, params2);

    if (messages.length) {
      const msgIds = messages.map(m => m.id);
      const allAttachments = await query(
        `SELECT * FROM message_attachments WHERE message_id IN (${msgIds.map(() => '?').join(',')})`,
        msgIds
      );
      const attachMap = {};
      allAttachments.forEach(a => {
        if (!attachMap[a.message_id]) attachMap[a.message_id] = [];
        attachMap[a.message_id].push(a);
      });
      messages.forEach(m => { m.attachments = attachMap[m.id] || []; });
    }

    await query(
      'UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = ? AND user_id = ?',
      [channelId, user.id]
    );

    return NextResponse.json(messages);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

export async function POST(request, { params }) {
  try {
    const user = await requireSession();
    const { id: channelId } = await params;
    const ip = getClientIp(request);
    if (!rateLimit(`msg:${user.id}`, 30, 60000)) {
      return NextResponse.json({ error: 'Too many messages. Slow down.' }, { status: 429 });
    }

    const raw = await request.json();
    const body = sanitizeString(raw.body, 10000);
    const threadId = raw.threadId;
    const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];

    if (!body && attachments.length === 0) {
      return NextResponse.json({ error: 'Message body or attachment required' }, { status: 400 });
    }

    const isMember = await queryOne(
      'SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, user.id]
    );
    if (!isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const normalizedBody = body?.trim() || (attachments.length ? 'Shared attachment' : '');
    const msgId = await insert(
      'INSERT INTO messages (channel_id, user_id, body, thread_id) VALUES (?, ?, ?, ?)',
      [channelId, user.id, normalizedBody, threadId || null]
    );

    if (attachments.length) {
      for (const att of attachments) {
        const safeUrl = sanitizeUrl(att.url);
        if (!safeUrl) continue;
        await insert(
          'INSERT INTO message_attachments (message_id, type, title, url, thumbnail_url, mime_type, size_bytes, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [msgId, att.type, att.title || '', safeUrl, att.thumbnailUrl || null, att.mimeType || null, att.sizeBytes || null, att.metadata ? JSON.stringify(att.metadata) : null]
        );
      }
    }

    const urlRegex = /https?:\/\/[^\s<]+/g;
    const urls = body ? body.match(urlRegex) : null;
    if (urls && attachments.length === 0) {
      for (const url of urls.slice(0, 3)) {
        const preview = await unfurlUrl(url);
        if (preview) {
          await insert(
            'INSERT INTO message_attachments (message_id, type, title, url, thumbnail_url, metadata) VALUES (?, ?, ?, ?, ?, ?)',
            [msgId, 'link', preview.title, url, preview.image || null, JSON.stringify(preview)]
          );
        }
      }
    }

    const message = await queryOne(
      `SELECT m.*, u.name as author_name, u.email as author_email, u.avatar_url as author_avatar
       FROM messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.id = ?`,
      [msgId]
    );

    const msgAttachments = await query(
      'SELECT * FROM message_attachments WHERE message_id = ?', [msgId]
    );
    message.attachments = msgAttachments;

    const hasMeaningfulText = Boolean(body && body.trim() && body.trim().toLowerCase() !== 'shared attachment');
    if (hasMeaningfulText) {
      const activeRoom = await queryOne(
        `SELECT r.id, r.livekit_room, t.domain as brand_domain, t.slug as tenant_slug, t.settings as tenant_settings
         FROM rooms r
         JOIN channels c ON c.id = r.channel_id
         JOIN tenants t ON t.id = c.tenant_id
         WHERE r.channel_id = ? AND r.status IN ('waiting', 'active')
         ORDER BY started_at DESC
         LIMIT 1`,
        [channelId]
      );

      if (activeRoom) {
        const latestAgentContext = await queryOne(
          `SELECT metadata FROM messages
           WHERE channel_id = ? AND type = 'ai'
           ORDER BY id DESC
           LIMIT 1`,
          [channelId]
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
          [channelId]
        );

        const recentMessages = recentRows
          .reverse()
          .map((row) => ({
            role: row.type === 'ai' ? 'assistant' : 'user',
            content: row.type === 'ai'
              ? row.body
              : `${row.author_name || row.author_email || 'User'}: ${row.body}`,
          }));

        const tenantSettings = parseTenantSettings(activeRoom.tenant_settings);
        const toneProfile = context.toneProfile || tenantSettings.brandAgentTone || 'consultative';
        const tone = resolveToneProfile(toneProfile);

        let agentReply = await generateClaudeAgentReply({
          latestUserMessage: body,
          recentMessages,
          meetingAbout: context.meetingAbout,
          expectedAttendees: context.expectedAttendees,
          expectedContributions: context.expectedContributions,
          brandDomain: context.brandDomain,
          toneProfile: tone.id,
        });

        if (!agentReply) {
          agentReply = buildBrandAgentReply({
            messageBody: body,
            meetingAbout: context.meetingAbout,
            expectedAttendees: context.expectedAttendees,
            expectedContributions: context.expectedContributions,
            senderName: user.name || user.email,
            toneProfile: tone.id,
          });
        }

        if (agentReply) {
          await insert(
            'INSERT INTO messages (channel_id, user_id, body, type, metadata) VALUES (?, ?, ?, ?, ?)',
            [
              channelId,
              null,
              agentReply,
              'ai',
              JSON.stringify({
                roomId: context.roomId || activeRoom.id,
                livekitRoom: context.livekitRoom || activeRoom.livekit_room,
                brandDomain: context.brandDomain || activeRoom.brand_domain || `${activeRoom.tenant_slug}.com`,
                brandLogo: context.brandLogo || `https://www.brandidentity.com/logo/${context.brandDomain || activeRoom.brand_domain || `${activeRoom.tenant_slug}.com`}`,
                toneProfile: tone.id,
                agentStatus: 'responded',
                sourceMessageId: msgId,
              }),
            ]
          );
        }
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
