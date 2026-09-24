import { NextResponse } from 'next/server';
import { query, queryOne, insert } from '@/lib/db.js';
import { withWorkspaceAdmin, audit } from '@/lib/workspace.js';
import { validateEmail, rateLimit } from '@/lib/security.js';
import { sendEach, layout, escapeHtml, APP_URL } from '@/lib/email.js';

const ROLES = ['owner', 'admin', 'member', 'guest'];

export const GET = withWorkspaceAdmin(async (request, { tenant }) => {
  const members = await query(
    `SELECT u.id, u.name, u.email, u.avatar_url, u.last_seen_at, tm.role, tm.joined_at, tm.muted_until, tm.rules_accepted_at
     FROM tenant_members tm JOIN users u ON u.id = tm.user_id
     WHERE tm.tenant_id = ?
     ORDER BY FIELD(tm.role, 'owner', 'admin', 'member', 'guest'), COALESCE(NULLIF(u.name, ''), u.email)`,
    [tenant.id]
  );
  return NextResponse.json({ members });
});

// Invite by email: adds them to the workspace (and its public channels) and emails a sign-in link.
export const POST = withWorkspaceAdmin(async (request, { user, tenant }) => {
  if (!rateLimit(`invite:${tenant.id}`, 10, 60000)) {
    return NextResponse.json({ error: 'Too many invites at once. Try again in a minute.' }, { status: 429 });
  }
  const b = await request.json().catch(() => ({}));
  const role = ['admin', 'member', 'guest'].includes(b.role) ? b.role : 'member';
  const emails = [...new Set(String(b.emails || '').split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const valid = emails.filter(validateEmail).slice(0, 50);
  if (!valid.length) return NextResponse.json({ error: 'Enter at least one valid email' }, { status: 400 });

  const added = [];
  for (const email of valid) {
    let invitee = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (!invitee) invitee = { id: await insert('INSERT INTO users (email) VALUES (?)', [email]) };
    const existing = await queryOne('SELECT id FROM tenant_members WHERE tenant_id = ? AND user_id = ?', [tenant.id, invitee.id]);
    if (existing) continue;
    await insert('INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, ?)', [tenant.id, invitee.id, role]);
    await query(
      `INSERT IGNORE INTO channel_members (channel_id, user_id)
       SELECT id, ? FROM channels WHERE tenant_id = ? AND is_private = 0 AND is_dm = 0`,
      [invitee.id, tenant.id]
    );
    added.push({ email, id: invitee.id });
  }

  const inviter = user.name || user.email;
  const note = String(b.message || '').slice(0, 500);
  const sent = await sendEach(added, ({ email }) => ({
    to: email,
    subject: `${inviter} invited you to ${tenant.name} on AppChat`,
    html: layout({
      title: `Join ${tenant.name} on AppChat`,
      bodyHtml: `<p>${escapeHtml(inviter)} invited you to the <b>${escapeHtml(tenant.name)}</b> workspace.</p>
        ${note ? `<blockquote style="border-left:3px solid #e4e4e7;margin:12px 0;padding-left:12px;color:#52525b">${escapeHtml(note)}</blockquote>` : ''}
        <p>Sign in with this email address (${escapeHtml(email)}) — no password needed.</p>`,
      cta: { label: 'Open AppChat', url: `${APP_URL}/login` },
    }),
  }));

  await audit(tenant.id, user.id, 'members.invite', added.map((a) => a.email).join(', '), { role, count: added.length });
  return NextResponse.json({
    added: added.length,
    emailed: sent,
    alreadyMembers: valid.length - added.length,
    invalid: emails.length - valid.length,
  });
});

// Change role, mute/unmute.
export const PATCH = withWorkspaceAdmin(async (request, { user, tenant }) => {
  const b = await request.json().catch(() => ({}));
  const target = await queryOne(
    'SELECT tm.role, u.email FROM tenant_members tm JOIN users u ON u.id = tm.user_id WHERE tm.tenant_id = ? AND tm.user_id = ?',
    [tenant.id, b.userId]
  );
  if (!target) return NextResponse.json({ error: 'Not a member' }, { status: 404 });
  const me = await queryOne('SELECT role FROM tenant_members WHERE tenant_id = ? AND user_id = ?', [tenant.id, user.id]);
  const iAmOwner = me?.role === 'owner' || user.is_admin;
  if (target.role === 'owner' && !iAmOwner) return NextResponse.json({ error: 'Only owners can change an owner' }, { status: 403 });

  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) return NextResponse.json({ error: 'Unknown role' }, { status: 400 });
    if (b.role === 'owner' && !iAmOwner) return NextResponse.json({ error: 'Only owners can make someone an owner' }, { status: 403 });
    if (target.role === 'owner' && b.role !== 'owner') {
      const owners = await queryOne("SELECT COUNT(*) AS n FROM tenant_members WHERE tenant_id = ? AND role = 'owner'", [tenant.id]);
      if (owners.n <= 1) return NextResponse.json({ error: 'A workspace needs at least one owner' }, { status: 400 });
    }
    await query('UPDATE tenant_members SET role = ? WHERE tenant_id = ? AND user_id = ?', [b.role, tenant.id, b.userId]);
    await audit(tenant.id, user.id, 'members.role', target.email, { from: target.role, to: b.role });
  }

  if (b.muteMinutes !== undefined) {
    if (Number(b.userId) === user.id) return NextResponse.json({ error: "You can't mute yourself" }, { status: 400 });
    const minutes = Number(b.muteMinutes);
    if (minutes > 0) {
      await query('UPDATE tenant_members SET muted_until = NOW() + INTERVAL ? MINUTE WHERE tenant_id = ? AND user_id = ?', [Math.min(minutes, 525600), tenant.id, b.userId]);
      await audit(tenant.id, user.id, 'members.mute', target.email, { minutes });
    } else {
      await query('UPDATE tenant_members SET muted_until = NULL WHERE tenant_id = ? AND user_id = ?', [tenant.id, b.userId]);
      await audit(tenant.id, user.id, 'members.unmute', target.email);
    }
  }
  return NextResponse.json({ ok: true });
});

// Remove from the workspace (and all its channels/DMs).
export const DELETE = withWorkspaceAdmin(async (request, { user, tenant }) => {
  const userId = Number(request.nextUrl.searchParams.get('userId'));
  const target = await queryOne(
    'SELECT tm.role, u.email FROM tenant_members tm JOIN users u ON u.id = tm.user_id WHERE tm.tenant_id = ? AND tm.user_id = ?',
    [tenant.id, userId]
  );
  if (!target) return NextResponse.json({ error: 'Not a member' }, { status: 404 });
  if (userId === user.id) return NextResponse.json({ error: "You can't remove yourself here" }, { status: 400 });
  if (target.role === 'owner') return NextResponse.json({ error: 'Change their role before removing an owner' }, { status: 400 });

  await query(
    'DELETE cm FROM channel_members cm JOIN channels c ON c.id = cm.channel_id WHERE c.tenant_id = ? AND cm.user_id = ?',
    [tenant.id, userId]
  );
  await query('DELETE FROM tenant_members WHERE tenant_id = ? AND user_id = ?', [tenant.id, userId]);
  await audit(tenant.id, user.id, 'members.remove', target.email);
  return NextResponse.json({ ok: true });
});
