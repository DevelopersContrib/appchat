import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { sendEmail, layout, escapeHtml, APP_URL, isEmailConfigured } from '@/lib/email.js';
import { parseTenantSettings } from '@/lib/brand-agent-profiles.js';

export const maxDuration = 300;

// Daily "what you missed" email (Vercel Cron, see vercel.json). For each person with digests on,
// summarize unread DMs and @mentions from the last day in workspaces that allow digests.
export async function GET(request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isEmailConfigured()) return NextResponse.json({ skipped: 'email not configured' });

  const rows = await query(
    `SELECT u.id AS user_id, u.email, u.name, t.id AS tenant_id, t.name AS tenant_name, t.slug, t.settings,
            c.id AS channel_id, c.name AS channel_name, c.is_dm,
            m.body, m.created_at, COALESCE(NULLIF(a.name, ''), a.email) AS author
     FROM users u
     JOIN channel_members cm ON cm.user_id = u.id
     JOIN channels c ON c.id = cm.channel_id AND c.archived_at IS NULL
     JOIN tenants t ON t.id = c.tenant_id
     JOIN messages m ON m.channel_id = c.id
       AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')
       AND m.created_at > GREATEST(COALESCE(u.digest_sent_at, '1970-01-01'), NOW() - INTERVAL 1 DAY)
       AND m.deleted_at IS NULL AND m.type = 'text' AND (m.user_id IS NULL OR m.user_id <> u.id)
     LEFT JOIN users a ON a.id = m.user_id
     WHERE u.email_digest = 1
       AND (c.is_dm = 1 OR m.body LIKE CONCAT('%@', COALESCE(NULLIF(u.name, ''), SUBSTRING_INDEX(u.email, '@', 1)), '%'))
     ORDER BY u.id, t.id, m.created_at
     LIMIT 5000`
  );

  const byUser = new Map();
  for (const r of rows) {
    if (parseTenantSettings(r.settings).emailDigest === false) continue;
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, { email: r.email, items: [] });
    byUser.get(r.user_id).items.push(r);
  }

  let sent = 0;
  for (const [userId, { email, items }] of byUser) {
    const list = items.slice(0, 20).map((i) => {
      const where = i.is_dm ? 'Direct message' : `#${i.channel_name}`;
      return `<li style="margin:0 0 10px"><b>${escapeHtml(i.author || 'Someone')}</b> <span style="color:#71717a">in ${escapeHtml(where)} · ${escapeHtml(i.tenant_name)}</span><br>
        <a href="${APP_URL}/${i.slug}/c/${i.channel_id}" style="color:#18181b">${escapeHtml(String(i.body).slice(0, 200))}</a></li>`;
    }).join('');
    try {
      await sendEmail({
        to: email,
        subject: `You have ${items.length} unread message${items.length === 1 ? '' : 's'} on AppChat`,
        html: layout({
          title: 'Here’s what you missed',
          bodyHtml: `<ul style="padding-left:18px">${list}</ul>${items.length > 20 ? `<p>…and ${items.length - 20} more.</p>` : ''}`,
          cta: { label: 'Catch up in AppChat', url: `${APP_URL}/dashboard` },
        }),
      });
      await query('UPDATE users SET digest_sent_at = NOW() WHERE id = ?', [userId]);
      sent++;
    } catch (err) {
      console.error('[digest]', email, err.message);
    }
  }
  return NextResponse.json({ sent });
}
