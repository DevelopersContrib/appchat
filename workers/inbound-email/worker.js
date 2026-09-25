// Cloudflare Email Worker: receives mail for c-<token>@appchat.com (Email Routing catch-all → this Worker),
// parses it, and hands it to AppChat, which posts it into the matching channel.
// Secrets: APPCHAT_URL (e.g. https://www.appchat.com), INBOUND_EMAIL_SECRET (same value as in AppChat).
import PostalMime from 'postal-mime';

export default {
  async email(message, env) {
    if (!/^c-[a-z0-9]+@/i.test(message.to)) {
      message.setReject('Unknown address');
      return;
    }
    const email = await PostalMime.parse(message.raw);
    const res = await fetch(`${env.APPCHAT_URL}/api/inbound-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-inbound-secret': env.INBOUND_EMAIL_SECRET },
      body: JSON.stringify({
        to: message.to,
        from: email.from?.address || message.from,
        fromName: email.from?.name || '',
        subject: email.subject || '',
        text: email.text || (email.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        attachments: (email.attachments || []).map((a) => ({ filename: a.filename, mimeType: a.mimeType, size: a.content?.byteLength })),
      }),
    });
    if (res.status === 404) message.setReject('This channel address is not active');
    else if (!res.ok) throw new Error(`AppChat rejected the email (${res.status})`); // Cloudflare retries/bounces
  },
};
