import 'server-only';
import { query } from './db.js';
import { sendEmail, layout, escapeHtml, APP_URL } from './email.js';
import { ONLINE_WINDOW_SECONDS } from './presence.js';

const DM_EMAIL_THROTTLE_MINUTES = 15;

/**
 * When someone sends a DM, email the other person if they're offline (or away) and have
 * offline-DM emails on. At most one email per conversation every 15 minutes.
 */
export async function notifyOfflineDmRecipients({ channelId, sender, body }) {
  const recipients = await query(
    `SELECT u.id, u.email, u.name, cm.last_emailed_at, t.name AS tenant_name, t.slug
     FROM channels c
     JOIN tenants t ON t.id = c.tenant_id
     JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id <> ?
     JOIN users u ON u.id = cm.user_id
     LEFT JOIN user_presence p ON p.user_id = u.id
     WHERE c.id = ? AND c.is_dm = 1
       AND u.email_offline_dms = 1
       AND (p.updated_at IS NULL OR p.updated_at < NOW() - INTERVAL ${ONLINE_WINDOW_SECONDS} SECOND OR p.status = 'away')
       AND (cm.last_emailed_at IS NULL OR cm.last_emailed_at < NOW() - INTERVAL ${DM_EMAIL_THROTTLE_MINUTES} MINUTE)`,
    [sender.id, channelId]
  );

  const from = sender.name || sender.email;
  for (const r of recipients) {
    const url = `${APP_URL}/${r.slug}/c/${channelId}`;
    const excerpt = String(body || '').slice(0, 500);
    await sendEmail({
      to: r.email,
      subject: `${from} sent you a message on ${r.tenant_name}`,
      html: layout({
        title: `New message from ${from}`,
        bodyHtml: `<p style="white-space:pre-wrap;background:#f4f4f5;border-radius:8px;padding:12px;margin:0">${escapeHtml(excerpt)}${body.length > 500 ? '…' : ''}</p>
          <p style="color:#71717a;font-size:13px">You're offline in ${escapeHtml(r.tenant_name)}, so we sent this to your email. Reply in AppChat.</p>`,
        cta: { label: 'Reply in AppChat', url },
      }),
      text: `${from} sent you a message on ${r.tenant_name}:\n\n${excerpt}\n\nReply: ${url}`,
    });
    await query('UPDATE channel_members SET last_emailed_at = NOW() WHERE channel_id = ? AND user_id = ?', [channelId, r.id]);
  }
}

/**
 * Email people who were @mentioned in a channel while offline/away (same preference and
 * 15-minute-per-conversation throttle as DM emails).
 */
export async function notifyMentions({ channelId, sender, body, mentions }) {
  const ids = (mentions?.userIds || []).filter((id) => id !== sender.id);
  if (!ids.length) return;
  const recipients = await query(
    `SELECT u.id, u.email, c.name AS channel_name, c.is_dm, t.name AS tenant_name, t.slug
     FROM channels c
     JOIN tenants t ON t.id = c.tenant_id
     JOIN channel_members cm ON cm.channel_id = c.id
     JOIN users u ON u.id = cm.user_id
     LEFT JOIN user_presence p ON p.user_id = u.id
     WHERE c.id = ? AND c.is_dm = 0 AND u.id IN (${ids.map(() => '?').join(',')})
       AND u.email_offline_dms = 1
       AND (p.updated_at IS NULL OR p.updated_at < NOW() - INTERVAL ${ONLINE_WINDOW_SECONDS} SECOND OR p.status = 'away')
       AND (cm.last_emailed_at IS NULL OR cm.last_emailed_at < NOW() - INTERVAL ${DM_EMAIL_THROTTLE_MINUTES} MINUTE)`,
    [channelId, ...ids]
  );
  const from = sender.name || sender.email;
  for (const r of recipients) {
    const url = `${APP_URL}/${r.slug}/c/${channelId}`;
    const excerpt = String(body || '').slice(0, 500);
    await sendEmail({
      to: r.email,
      subject: `${from} mentioned you in #${r.channel_name}`,
      html: layout({
        title: `${from} mentioned you in #${r.channel_name}`,
        bodyHtml: `<p style="white-space:pre-wrap;background:#f4f4f5;border-radius:8px;padding:12px;margin:0">${escapeHtml(excerpt)}</p>
          <p style="color:#71717a;font-size:13px">${escapeHtml(r.tenant_name)}</p>`,
        cta: { label: 'Open the conversation', url },
      }),
      text: `${from} mentioned you in #${r.channel_name} (${r.tenant_name}):\n\n${excerpt}\n\n${url}`,
    });
    await query('UPDATE channel_members SET last_emailed_at = NOW() WHERE channel_id = ? AND user_id = ?', [channelId, r.id]);
  }
}
