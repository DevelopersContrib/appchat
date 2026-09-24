import { NextResponse, after } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { query, insert, queryOne } from '@/lib/db.js';
import { unfurlUrl } from '@/lib/unfurl.js';
import { rateLimit, getClientIp, sanitizeString, sanitizeUrl } from '@/lib/security.js';
import { parseChannelFromKey, fileUrlForKey } from '@/lib/storage.js';
import { assertCanPost, applyWordFilter } from '@/lib/workspace.js';
import { notifyOfflineDmRecipients, notifyMentions } from '@/lib/notify.js';
import { MESSAGE_SELECT, hydrateMessages, findMentions } from '@/lib/messages.js';
import { pushToChannelRecipients } from '@/lib/push.js';
import { buildBrandAgentReply } from '@/lib/brand-agent.js';
import { generateClaudeAgentReply } from '@/lib/claude-agent.js';
import { parseTenantSettings, resolveToneProfile } from '@/lib/brand-agent-profiles.js';

const TYPING_WINDOW_MS = 6000;

/**
 * Channel timeline (thread replies excluded — they're in the thread panel).
 *   ?before=<id>            older page
 *   ?thread=<id>            a thread: the parent plus all replies
 *   ?after=<id>&since=<ms>  live sync: { messages (new), changed (edited/deleted/reactions/reply counts), typing, now }
 *   (none)                  latest 100
 */
export async function GET(request, { params }) {
  try {
    const user = await requireSession();
    const { id: channelId } = await params;
    const sp = request.nextUrl.searchParams;

    const isMember = await queryOne(
      'SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, user.id]
    );
    if (!isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const threadId = sp.get('thread');
    if (threadId) {
      const rows = await query(
        `${MESSAGE_SELECT} WHERE m.channel_id = ? AND (m.id = ? OR m.thread_id = ?) AND m.deleted_at IS NULL
         ORDER BY m.created_at ASC, m.id ASC LIMIT 500`,
        [channelId, threadId, threadId]
      );
      return NextResponse.json(await hydrateMessages(rows, user.id));
    }

    const before = sp.get('before');
    if (before) {
      const cursor = await queryOne('SELECT created_at, id FROM messages WHERE id = ? AND channel_id = ?', [before, channelId]);
      if (!cursor) return NextResponse.json([]);
      const rows = await query(
        `${MESSAGE_SELECT} WHERE m.channel_id = ? AND m.deleted_at IS NULL AND m.thread_id IS NULL
           AND (m.created_at < ? OR (m.created_at = ? AND m.id < ?))
         ORDER BY m.created_at DESC, m.id DESC LIMIT 100`,
        [channelId, cursor.created_at, cursor.created_at, cursor.id]
      );
      return NextResponse.json(await hydrateMessages(rows.reverse(), user.id));
    }

    const after = sp.get('after');
    if (after) {
      const [{ now }] = await query('SELECT NOW(3) AS now');
      const since = sp.get('since') ? new Date(Number(sp.get('since'))) : null;
      // New top-level messages. Skip back-dated rows (e.g. an import running now) older than the cursor.
      const fresh = await query(
        `${MESSAGE_SELECT} WHERE m.channel_id = ? AND m.id > ? AND m.deleted_at IS NULL AND m.thread_id IS NULL
           AND m.created_at >= COALESCE((SELECT created_at FROM messages WHERE id = ? AND channel_id = ?), '1970-01-01')
         ORDER BY m.id ASC LIMIT 100`,
        [channelId, after, after, channelId]
      );
      // Already-loaded messages that changed: edits, deletes, reactions, new thread replies.
      const changed = since
        ? await query(
            `${MESSAGE_SELECT} WHERE m.channel_id = ? AND m.id <= ? AND m.thread_id IS NULL AND m.updated_at > ?
             ORDER BY m.id ASC LIMIT 200`,
            [channelId, after, since]
          )
        : [];
      const typing = await query(
        `SELECT COALESCE(NULLIF(u.name, ''), SUBSTRING_INDEX(u.email, '@', 1)) AS name
         FROM user_presence p JOIN users u ON u.id = p.user_id
         WHERE p.typing_channel_id = ? AND p.typing_at > NOW(3) - INTERVAL ${TYPING_WINDOW_MS / 1000} SECOND AND p.user_id <> ?`,
        [channelId, user.id]
      );
      await query('UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = ? AND user_id = ?', [channelId, user.id]);
      return NextResponse.json({
        messages: await hydrateMessages(fresh, user.id),
        changed: await hydrateMessages(changed, user.id),
        typing: typing.map((t) => t.name),
        now: new Date(now).getTime(),
      });
    }

    const rows = await query(
      `${MESSAGE_SELECT} WHERE m.channel_id = ? AND m.deleted_at IS NULL AND m.thread_id IS NULL
       ORDER BY m.created_at DESC, m.id DESC LIMIT 100`,
      [channelId]
    );
    await query('UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = ? AND user_id = ?', [channelId, user.id]);
    return NextResponse.json(await hydrateMessages(rows.reverse(), user.id));
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
    const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];

    if (!body && attachments.length === 0) {
      return NextResponse.json({ error: 'Message body or attachment required' }, { status: 400 });
    }

    const isMember = await queryOne(
      'SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, user.id]
    );
    if (!isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    // Moderation: muted members can't post; banned words are masked.
    let workspaceSettings;
    try {
      workspaceSettings = await assertCanPost(channelId, user.id);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: err.status || 403 });
    }
    const normalizedBody = applyWordFilter(body?.trim(), workspaceSettings.bannedWords) || (attachments.length ? 'Shared attachment' : '');

    // Thread reply (goes to the thread panel) and/or quote-reply; both must point into this channel.
    let threadId = null;
    if (raw.threadId) {
      const parent = await queryOne('SELECT id, thread_id FROM messages WHERE id = ? AND channel_id = ? AND deleted_at IS NULL', [raw.threadId, channelId]);
      if (!parent) return NextResponse.json({ error: 'That thread no longer exists' }, { status: 404 });
      threadId = parent.thread_id || parent.id;
    }
    let replyToId = null;
    if (raw.replyToId) {
      const target = await queryOne('SELECT id FROM messages WHERE id = ? AND channel_id = ?', [raw.replyToId, channelId]);
      replyToId = target?.id || null;
    }

    // @mentions of people in this channel (plus @channel/@here).
    const channelMembers = await query(
      `SELECT u.id, NULLIF(u.name, '') AS name, u.email FROM channel_members cm JOIN users u ON u.id = cm.user_id WHERE cm.channel_id = ?`,
      [channelId]
    );
    const mentions = findMentions(normalizedBody, channelMembers);
    const metadata = mentions.userIds.length || mentions.everyone ? JSON.stringify({ mentions: mentions.userIds, mentionsEveryone: mentions.everyone }) : null;

    const msgId = await insert(
      'INSERT INTO messages (channel_id, user_id, body, thread_id, reply_to_id, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [channelId, user.id, normalizedBody, threadId, replyToId, metadata]
    );
    // Bump the thread parent so open chats refresh its reply count; clear "typing…".
    if (threadId) await query('UPDATE messages SET updated_at = NOW(3) WHERE id = ?', [threadId]);
    await query('UPDATE user_presence SET typing_channel_id = NULL WHERE user_id = ?', [user.id]);

    if (attachments.length) {
      for (const att of attachments.slice(0, 10)) {
        if (att.storageKey) {
          // Uploaded file: the key must belong to this channel (it was issued by /api/uploads for it).
          if (parseChannelFromKey(att.storageKey)?.channelId !== Number(channelId)) continue;
          await insert(
            'INSERT INTO message_attachments (message_id, type, title, url, mime_type, size_bytes, storage_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [msgId, 'file', sanitizeString(att.title, 255) || 'file', fileUrlForKey(att.storageKey), sanitizeString(att.mimeType, 100) || null, Number(att.sizeBytes) || null, att.storageKey]
          );
          continue;
        }
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

    const [message] = await hydrateMessages(await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [msgId]), user.id);

    // The Brand Agent only answers in the main channel, not in threads.
    const hasMeaningfulText = Boolean(body && body.trim() && body.trim().toLowerCase() !== 'shared attachment');
    if (hasMeaningfulText && !threadId) {
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

    // Notifications run after the response is sent:
    //  - push to phones/desktops for DMs and @mentions
    //  - email offline people about DMs (throttled) and @mentions
    after(async () => {
      const ctx = { channelId: Number(channelId), messageId: msgId, sender: user, body: normalizedBody, mentions };
      await pushToChannelRecipients(ctx).catch((err) => console.error('[push]', err));
      if (workspaceSettings.emailOfflineDms !== false) {
        await notifyOfflineDmRecipients(ctx).catch((err) => console.error('[notify]', err));
      }
      if (mentions.userIds.length) await notifyMentions(ctx).catch((err) => console.error('[notify]', err));
    });

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
