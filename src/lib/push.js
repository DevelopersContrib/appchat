import 'server-only';
import webpush from 'web-push';
import { query } from './db.js';
import { APP_URL } from './email.js';
import { ONLINE_WINDOW_SECONDS } from './presence.js';

// Web push (installed app on phones, and desktop browsers). Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
let configured = false;
export function isPushConfigured() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@vnoc.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export async function sendPush(userIds, payload) {
  if (!isPushConfigured() || !userIds.length) return 0;
  const subs = await query(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
    } catch (err) {
      // The browser dropped this subscription (uninstalled, permission revoked) — forget it.
      if (err.statusCode === 404 || err.statusCode === 410) await query('DELETE FROM push_subscriptions WHERE id = ?', [s.id]);
      else console.error('[push]', err.statusCode, err.body || err.message);
    }
  }));
  return sent;
}

/**
 * Who gets a push for a new message: the other person in a DM, or people @mentioned in a channel
 * (@channel/@here: everyone in it) — never the sender, and not people who are looking at this chat right now.
 */
export async function pushToChannelRecipients({ channelId, sender, body, mentions }) {
  if (!isPushConfigured()) return 0;
  const [channel] = await query(
    'SELECT c.id, c.name, c.is_dm, t.slug, t.name AS tenant_name FROM channels c JOIN tenants t ON t.id = c.tenant_id WHERE c.id = ?',
    [channelId]
  );
  if (!channel) return 0;

  let recipients;
  if (channel.is_dm || mentions?.everyone) {
    recipients = (await query('SELECT user_id FROM channel_members WHERE channel_id = ? AND user_id <> ?', [channelId, sender.id])).map((r) => r.user_id);
  } else {
    recipients = (mentions?.userIds || []).filter((id) => id !== sender.id);
  }
  if (!recipients.length) return 0;

  const viewing = await query(
    `SELECT user_id FROM user_presence WHERE channel_id = ? AND status = 'active'
       AND updated_at > NOW() - INTERVAL ${ONLINE_WINDOW_SECONDS} SECOND AND user_id IN (${recipients.map(() => '?').join(',')})`,
    [channelId, ...recipients]
  );
  const skip = new Set(viewing.map((v) => v.user_id));
  recipients = recipients.filter((id) => !skip.has(id));

  const from = sender.name || sender.email;
  return sendPush(recipients, {
    title: channel.is_dm ? from : `${from} in #${channel.name}`,
    body: String(body || '').slice(0, 180),
    url: `${APP_URL}/${channel.slug}/c/${channel.id}`,
    tag: `channel-${channel.id}`,
  });
}
