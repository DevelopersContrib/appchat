// Network-wide inbound email router (Cloudflare Email Worker "email-router", account Admin@domaindirectory.com).
// Recovered from the deployed bundle on 2026-09-25 and kept here under version control.
// Routes: sales/partners/support-style addresses → DealAgent/PartnerAgent/SupportAgent; every email is logged to
// InferAgent and forwarded to the human catch-all inbox. AppChat channel addresses (c-<token>@appchat.com)
// are delivered to AppChat instead (see handleAppChat).
// Secrets: ROUTER_SECRET, INFERAGENT_URL, INFERAGENT_INGEST_SECRET, APPCHAT_INBOUND_SECRET (APPCHAT_URL is a var).
import PostalMime from 'postal-mime';

const CATCHALL_DESTINATION = 'chad@vnoc.com';
const ROUTES = [
  { agent: 'DealAgent', endpoint: 'https://dealagent.com/api/contact', patterns: ['sales', 'domains', 'buy', 'offer', 'purchase', 'acquire'] },
  { agent: 'PartnerAgent', endpoint: 'https://partneragent.com/api/contact', patterns: ['partner', 'partners', 'partnership', 'partnerships', 'bd'] },
  { agent: 'SupportAgent', endpoint: 'https://supportagent.com/api/contact', patterns: ['support', 'help', 'helpdesk'] },
];

function extractEmail(h) {
  if (!h) return 'unknown@unknown';
  const m = h.match(/<([^>]+)>/);
  return (m ? m[1] : h).trim();
}

function extractName(h) {
  if (!h) return '';
  const m = h.match(/^([^<]+)</);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

function routeFor(localPart) {
  const lp = (localPart || '').toLowerCase();
  for (const r of ROUTES) for (const p of r.patterns) {
    if (lp === p || lp === p + 's' || lp.startsWith(p + '.') || lp.startsWith(p + '-') || lp.startsWith(p + '_') || lp.startsWith(p + '+')) return r;
  }
  return null;
}

// AppChat channel addresses: c-<token>@appchat.com → posted into that AppChat channel.
async function handleAppChat(message, env) {
  const email = await PostalMime.parse(message.raw);
  const res = await fetch(`${env.APPCHAT_URL || 'https://www.appchat.com'}/api/inbound-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-inbound-secret': env.APPCHAT_INBOUND_SECRET || '' },
    body: JSON.stringify({
      to: message.to,
      from: email.from?.address || message.from,
      fromName: email.from?.name || '',
      subject: email.subject || '',
      text: email.text || (email.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      attachments: (email.attachments || []).map((a) => ({ filename: a.filename, mimeType: a.mimeType, size: a.content?.byteLength })),
    }),
  });
  if (res.status === 404) {
    message.setReject('This AppChat channel address is not active');
    return;
  }
  if (!res.ok) throw new Error(`AppChat rejected the email (${res.status})`); // Cloudflare will retry/bounce
  console.log(`[email-router] AppChat delivered ${message.to}`);
}

export default {
  async email(message, env, ctx) {
    const toAddress = (message.to || '').toLowerCase();
    const atIdx = toAddress.indexOf('@');
    const localPart = atIdx > -1 ? toAddress.slice(0, atIdx) : toAddress;
    const recipientDomain = atIdx > -1 ? toAddress.slice(atIdx + 1) : '';

    if (recipientDomain === 'appchat.com' && /^c-[a-z0-9]+$/.test(localPart)) {
      await handleAppChat(message, env);
      return;
    }

    const fromHeader = message.headers.get('from') || message.from || '';
    const subject = message.headers.get('subject') || '(no subject)';
    const senderEmail = extractEmail(fromHeader);
    const senderName = extractName(fromHeader);
    const messageId = message.headers.get('message-id') || '';
    const route = routeFor(localPart);
    if (route) {
      const body = [
        '[inbound-email-router]',
        `to: ${toAddress}`,
        `from: ${senderEmail}`,
        senderName ? `name: ${senderName}` : '',
        `subject: ${subject}`,
        messageId ? `message-id: ${messageId}` : '',
        `origin-domain: ${recipientDomain}`,
        `origin-localpart: ${localPart}`,
        `route: ${route.agent}`,
        '',
        `(Raw body forwarded to ${CATCHALL_DESTINATION} for human visibility.)`,
      ].filter(Boolean).join('\n');
      ctx.waitUntil(
        fetch(route.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Router-Secret': env.ROUTER_SECRET || '' },
          body: JSON.stringify({ name: senderName, email: senderEmail, message: body }),
        }).then(async (r) => {
          if (r.ok) console.log(`[email-router] ${route.agent} logged: ${localPart}@${recipientDomain} from ${senderEmail}`);
          else {
            const t = await r.text().catch(() => '');
            console.error(`[email-router] ${route.agent} POST ${r.status}: ${toAddress} — ${t.slice(0, 200)}`);
          }
        }).catch((e) => console.error(`[email-router] ${route.agent} POST error for ${toAddress}: ${e.message}`))
      );
    } else {
      console.log(`[email-router] no-route (catch-all) ${toAddress} from ${senderEmail}`);
    }
    if (env.INFERAGENT_URL && env.INFERAGENT_INGEST_SECRET) {
      ctx.waitUntil(fetch(env.INFERAGENT_URL + '/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ingest-Secret': env.INFERAGENT_INGEST_SECRET },
        body: JSON.stringify({ source_type: 'email', source_domain: recipientDomain, from_email: senderEmail, from_name: senderName, to: toAddress, subject, body: '(catchall - body in email-router inbound stream)', message_id: messageId, routed_to: route?.agent || 'catchall' }),
      }).catch((e) => console.error('[email-router] InferAgent post error: ' + e.message)));
    }
    await message.forward(CATCHALL_DESTINATION);
  },
};
