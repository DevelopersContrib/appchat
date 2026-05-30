import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { insert, queryOne, query } from '@/lib/db.js';
import { validateSlug, validateEmail, sanitizeString, rateLimit, getClientIp } from '@/lib/security.js';

export async function POST(request) {
  try {
    const user = await requireSession();
    const body = await request.json();
    const { name, slug, logoUrl, brandColor, crmWebhook, channels, inviteEmails } = body;

    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json({ error: 'Name and slug required' }, { status: 400 });
    }

    const ip = getClientIp(request);
    if (!rateLimit(`tenant:${user.id}`, 5, 300000)) {
      return NextResponse.json({ error: 'Too many workspaces created. Try again later.' }, { status: 429 });
    }

    if (!validateSlug(slug)) {
      return NextResponse.json({ error: 'Invalid slug. Must be 2-63 chars, lowercase alphanumeric and hyphens. Cannot use reserved names.' }, { status: 400 });
    }

    const existing = await queryOne('SELECT id FROM tenants WHERE slug = ?', [slug]);
    if (existing) {
      return NextResponse.json({ error: 'This URL is already taken' }, { status: 409 });
    }

    const tenantId = await insert(
      'INSERT INTO tenants (slug, name, logo_url, brand_color, crm_webhook_url) VALUES (?, ?, ?, ?, ?)',
      [
        slug,
        name.trim(),
        logoUrl || `https://www.brandidentity.com/logo/${slug}.com`,
        brandColor || '#2563eb',
        crmWebhook || null,
      ]
    );

    await insert(
      'INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, ?)',
      [tenantId, user.id, 'owner']
    );

    const channelList = channels?.length ? channels : ['general'];
    for (const ch of channelList) {
      const channelId = await insert(
        'INSERT INTO channels (tenant_id, name, description, created_by) VALUES (?, ?, ?, ?)',
        [tenantId, ch, ch === 'general' ? 'General discussion' : '', user.id]
      );

      await insert(
        'INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)',
        [channelId, user.id]
      );

      if (ch === channelList[0]) {
        await insert(
          'INSERT INTO messages (channel_id, body, type) VALUES (?, ?, ?)',
          [channelId, `Welcome to ${name.trim()}! This is your #${ch} channel.`, 'system']
        );
      }
    }

    if (inviteEmails?.length) {
      for (const email of inviteEmails) {
        if (!email?.trim() || !validateEmail(email.trim())) continue;

        let invitedUser = await queryOne('SELECT id FROM users WHERE email = ?', [email.trim()]);
        if (!invitedUser) {
          const uid = await insert(
            'INSERT INTO users (email, last_seen_at) VALUES (?, NULL)',
            [email.trim()]
          );
          invitedUser = { id: uid };
        }

        const alreadyMember = await queryOne(
          'SELECT id FROM tenant_members WHERE tenant_id = ? AND user_id = ?',
          [tenantId, invitedUser.id]
        );
        if (!alreadyMember) {
          await insert(
            'INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, ?)',
            [tenantId, invitedUser.id, 'member']
          );

          const allChannels = await query(
            'SELECT id FROM channels WHERE tenant_id = ?',
            [tenantId]
          );
          for (const c of allChannels) {
            await insert(
              'INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)',
              [c.id, invitedUser.id]
            );
          }
        }
      }
    }

    return NextResponse.json({ slug, id: tenantId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
