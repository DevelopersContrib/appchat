import { NextResponse } from 'next/server';
import { query, insert, queryOne } from '@/lib/db.js';
import { withWorkspaceAdmin, audit } from '@/lib/workspace.js';
import { sanitizeString, rateLimit } from '@/lib/security.js';
import { sendEach, layout, escapeHtml, APP_URL } from '@/lib/email.js';

export const maxDuration = 300;

// Email an announcement to every workspace member, and optionally post it in a channel.
export const POST = withWorkspaceAdmin(async (request, { user, tenant }) => {
  if (!rateLimit(`announce:${tenant.id}`, 3, 3600000)) {
    return NextResponse.json({ error: 'You can send up to 3 announcements an hour.' }, { status: 429 });
  }
  const b = await request.json().catch(() => ({}));
  const subject = sanitizeString(b.subject, 200);
  const message = sanitizeString(b.message, 10000);
  if (!subject || !message) return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });

  const members = await query(
    'SELECT u.email, u.name FROM tenant_members tm JOIN users u ON u.id = tm.user_id WHERE tm.tenant_id = ?',
    [tenant.id]
  );
  const from = user.name || user.email;
  const sent = await sendEach(members, (m) => ({
    to: m.email,
    subject: `[${tenant.name}] ${subject}`,
    html: layout({
      title: subject,
      bodyHtml: `<p style="white-space:pre-wrap">${escapeHtml(message)}</p><p style="color:#71717a;font-size:13px">— ${escapeHtml(from)}, ${escapeHtml(tenant.name)}</p>`,
      cta: { label: `Open ${tenant.name}`, url: `${APP_URL}/${tenant.slug}` },
    }),
    text: `${subject}\n\n${message}\n\n— ${from}, ${tenant.name}\n${APP_URL}/${tenant.slug}`,
  }));

  if (b.channelId) {
    const ch = await queryOne('SELECT id FROM channels WHERE id = ? AND tenant_id = ? AND is_dm = 0', [b.channelId, tenant.id]);
    if (ch) await insert('INSERT INTO messages (channel_id, user_id, body) VALUES (?, ?, ?)', [ch.id, user.id, `📣 ${subject}\n\n${message}`]);
  }
  await audit(tenant.id, user.id, 'email.announce', subject, { recipients: members.length, sent });
  return NextResponse.json({ sent, total: members.length });
});
