import { NextResponse } from 'next/server';
import { query, queryOne, insert } from '@/lib/db.js';
import { withWorkspaceAdmin, audit } from '@/lib/workspace.js';
import { getVnocAccess, resolveDomain, getDomainTeam, suggestDomainForChannel } from '@/lib/vnoc.js';
import { sendEach, layout, escapeHtml, APP_URL } from '@/lib/email.js';

export const maxDuration = 120;

// Channels with their linked (or best-guess) VNOC domain and how many people are on that domain's team.
export const GET = withWorkspaceAdmin(async (request, { user, tenant }) => {
  const access = await getVnocAccess(user);
  const channels = await query(
    `SELECT id, name, is_private, vnoc_domain,
            (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) AS member_count
     FROM channels c WHERE tenant_id = ? AND is_dm = 0 AND archived_at IS NULL ORDER BY name`,
    [tenant.id]
  );
  // Lookups run in parallel; the VNOC connection pool (5) paces them.
  const out = await Promise.all(channels.map(async (c) => {
    const domain = c.vnoc_domain ? await resolveDomain(access, c.vnoc_domain) : await suggestDomainForChannel(access, c.name);
    const team = domain ? await getDomainTeam(domain.domain_id) : [];
    return {
      id: c.id,
      name: c.name,
      isPrivate: Boolean(c.is_private),
      members: Number(c.member_count),
      linkedDomain: c.vnoc_domain,
      domain: domain?.domain_name || c.vnoc_domain || null,
      suggested: !c.vnoc_domain && Boolean(domain),
      teamSize: team.length,
    };
  }));
  return NextResponse.json({ channels: out, isVnocAdmin: access.isAdmin });
});

// Link a channel to a VNOC domain and add that domain's team to the workspace and the channel.
export const POST = withWorkspaceAdmin(async (request, { user, tenant }) => {
  const b = await request.json().catch(() => ({}));
  // Optional: also link a channel to the domain and add the team to it.
  const channel = b.channelId
    ? await queryOne('SELECT id, name, is_private FROM channels WHERE id = ? AND tenant_id = ? AND is_dm = 0', [b.channelId, tenant.id])
    : null;
  if (b.channelId && !channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

  const access = await getVnocAccess(user);
  const domain = await resolveDomain(access, b.domain);
  if (!domain) return NextResponse.json({ error: "That VNOC domain wasn't found, or you don't have access to it" }, { status: 403 });

  if (channel) await query('UPDATE channels SET vnoc_domain = ? WHERE id = ?', [domain.domain_name, channel.id]);
  // Optionally only some of the team (emails picked in the preview).
  const only = Array.isArray(b.emails) ? new Set(b.emails.map((e) => String(e).toLowerCase())) : null;
  const team = (await getDomainTeam(domain.domain_id)).filter((p) => !only || only.has(p.email));

  const newToWorkspace = [];
  let addedToChannel = 0;
  for (const person of team) {
    let u = await queryOne('SELECT id, name FROM users WHERE email = ?', [person.email]);
    if (!u) u = { id: await insert('INSERT INTO users (email, name) VALUES (?, ?)', [person.email, person.name]) };
    const member = await queryOne('SELECT id FROM tenant_members WHERE tenant_id = ? AND user_id = ?', [tenant.id, u.id]);
    if (!member) {
      await insert('INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, ?)', [tenant.id, u.id, 'member']);
      // New workspace members also join the workspace's public channels, like any invite.
      await query(
        'INSERT IGNORE INTO channel_members (channel_id, user_id) SELECT id, ? FROM channels WHERE tenant_id = ? AND is_private = 0 AND is_dm = 0 AND archived_at IS NULL',
        [u.id, tenant.id]
      );
      newToWorkspace.push({ email: person.email, name: person.name });
    }
    if (channel) {
      const res = await query('INSERT IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)', [channel.id, u.id]);
      addedToChannel += res.affectedRows;
    }
  }

  let emailed = 0;
  if (b.invite && newToWorkspace.length) {
    const inviter = user.name || user.email;
    emailed = await sendEach(newToWorkspace, ({ email, name }) => ({
      to: email,
      subject: `You've been added to ${tenant.name} on AppChat`,
      html: layout({
        title: `Join the ${domain.domain_name} team chat`,
        bodyHtml: `<p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(inviter)} added the <b>${escapeHtml(domain.domain_name)}</b> team to ${channel ? `<b>#${escapeHtml(channel.name)}</b> in ` : ''}${escapeHtml(tenant.name)} on AppChat.</p>
          <p>Sign in with this email address (${escapeHtml(email)}) — no password needed.</p>`,
        cta: { label: 'Open AppChat', url: `${APP_URL}/login` },
      }),
    }));
  }

  if (channel && addedToChannel) {
    await insert('INSERT INTO messages (channel_id, body, type) VALUES (?, ?, ?)', [
      channel.id,
      `${user.name || user.email} added the ${domain.domain_name} team (${addedToChannel} ${addedToChannel === 1 ? 'person' : 'people'})`,
      'system',
    ]);
  }
  await audit(tenant.id, user.id, 'vnoc.team_import', `${channel ? `#${channel.name}` : 'workspace'} ← ${domain.domain_name}`, {
    team: team.length, addedToChannel, newToWorkspace: newToWorkspace.length, emailed,
  });
  return NextResponse.json({ domain: domain.domain_name, team: team.length, addedToChannel, newToWorkspace: newToWorkspace.length, emailed });
});
