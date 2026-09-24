import 'server-only';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Email via VNOC's Amazon SES (same env names as vnoc/manage-app).
// Sender: EMAIL_FROM if set, else "AppChat" at the AWS_SES_FROM address (a verified vnoc.com identity).
// Once appchat.com is verified in SES, set EMAIL_FROM="AppChat <notify@appchat.com>".
let client;
function ses() {
  client ??= new SESClient({
    region: process.env.AWS_SES_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

export function isEmailConfigured() {
  return Boolean(process.env.AWS_SES_ACCESS_KEY_ID && (process.env.EMAIL_FROM || process.env.AWS_SES_FROM));
}

function fromAddress() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  const addr = /<([^>]+)>/.exec(process.env.AWS_SES_FROM || '')?.[1] || process.env.AWS_SES_FROM;
  return `AppChat <${addr}>`;
}

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.appchat.com').replace(/\/$/, '');

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * Simple branded layout. `bodyHtml` must already be escaped; use escapeHtml() on user content.
 * Every email carries a footer linking to notification settings.
 */
export function layout({ title, bodyHtml, cta, footer }) {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${cta.url}" style="background:#d63031;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e4e4e7">
      <h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(title)}</h1>
      ${bodyHtml}
      ${button}
    </div>
    <p style="font-size:12px;color:#71717a;margin-top:16px">${footer || `You're getting this because you're a member of an AppChat workspace. <a href="${APP_URL}/dashboard" style="color:#71717a">Manage email settings</a>.`}</p>
  </div></body></html>`;
}

export async function sendEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) {
    console.warn('[email] not configured; skipped:', subject);
    return false;
  }
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return false;
  await ses().send(
    new SendEmailCommand({
      Source: fromAddress(),
      Destination: { ToAddresses: recipients },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
          ...(text ? { Text: { Data: text, Charset: 'UTF-8' } } : {}),
        },
      },
    })
  );
  return true;
}

// Send to many people one at a time (each gets their own email, no shared To: line), within SES rate limits.
export async function sendEach(recipients, build) {
  let sent = 0;
  for (const r of recipients) {
    try {
      if (await sendEmail(build(r))) sent++;
    } catch (err) {
      console.error('[email] failed for', r.email, err.message);
    }
    await new Promise((res) => setTimeout(res, 100));
  }
  return sent;
}
