import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { query, queryOne, insert } from '@/lib/db.js';

// Called by the Cloudflare email Worker (workers/inbound-email) with a parsed email:
// { to, from, fromName, subject, text, attachments: [{ filename, mimeType, size }] }
// Auth: header x-inbound-secret = INBOUND_EMAIL_SECRET.
export async function POST(request) {
  const secret = process.env.INBOUND_EMAIL_SECRET || '';
  const given = request.headers.get('x-inbound-secret') || '';
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const b = await request.json().catch(() => ({}));
  const token = /^c-([a-z0-9]+)@/i.exec(String(b.to || '').trim())?.[1]?.toLowerCase();
  if (!token) return NextResponse.json({ error: 'Unknown address' }, { status: 404 });

  const channel = await queryOne('SELECT id, tenant_id FROM channels WHERE email_token = ? AND archived_at IS NULL', [token]);
  if (!channel) return NextResponse.json({ error: 'Unknown address' }, { status: 404 });

  const from = String(b.from || '').toLowerCase().slice(0, 254);
  // Show it as the sender's AppChat account when they're in this workspace.
  const sender = from
    ? await queryOne(
        'SELECT u.id FROM users u JOIN tenant_members tm ON tm.user_id = u.id AND tm.tenant_id = ? WHERE LOWER(u.email) = ?',
        [channel.tenant_id, from]
      )
    : null;

  const subject = String(b.subject || '(no subject)').slice(0, 300);
  // Keep the new part of the message: drop quoted replies ("On … wrote:" and "> " lines).
  const text = String(b.text || '')
    .split(/\n(?:On .+ wrote:|-{2,}\s*Original Message\s*-{2,}|From: .+)\n/)[0]
    .split('\n').filter((l) => !l.startsWith('>')).join('\n')
    .trim()
    .slice(0, 8000);
  const files = (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 10).map((a) => String(a.filename || 'file').slice(0, 120));

  await insert('INSERT INTO messages (channel_id, user_id, body, type, metadata, source) VALUES (?, ?, ?, ?, ?, ?)', [
    channel.id,
    sender?.id || null,
    `📧 ${subject}\n\n${text}${files.length ? `\n\n📎 ${files.join(', ')}` : ''}`,
    'text',
    JSON.stringify({
      source: 'email',
      card: { kind: 'email', subject, from, fromName: String(b.fromName || '').slice(0, 120), files },
      ...(!sender && { author: { id: `email:${from}`, name: b.fromName || from || 'Email' } }),
    }),
    'email',
  ]);
  return NextResponse.json({ ok: true });
}
