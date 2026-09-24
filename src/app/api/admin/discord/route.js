import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { query } from '@/lib/db.js';
import { requireTenantAdmin } from '@/lib/tenant.js';
import { botInviteUrl, loadGuild, listBotGuilds, SOURCE } from '@/lib/discord-import.js';

// Import screen data: bot setup status, and (with ?guild=) the server's channels + import progress.
export async function GET(request) {
  const user = await requireSession().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const admin = await requireTenantAdmin(sp.get('tenant'), user).catch(() => null);
  if (!admin) return NextResponse.json({ error: 'Only workspace admins can import' }, { status: 403 });

  const setup = { configured: Boolean(process.env.DISCORD_BOT_TOKEN), inviteUrl: botInviteUrl() };
  const guildId = (sp.get('guild') || '').trim();
  if (!guildId) {
    const guilds = setup.configured ? await listBotGuilds().catch(() => []) : [];
    return NextResponse.json({ ...setup, guilds });
  }
  if (!/^\d{5,25}$/.test(guildId)) return NextResponse.json({ error: 'That doesn’t look like a Discord server ID' }, { status: 400 });

  try {
    const guild = await loadGuild(guildId);
    const linked = await query(
      `SELECT c.id, c.external_id, COUNT(m.id) AS imported
       FROM channels c LEFT JOIN messages m ON m.channel_id = c.id AND m.source = ?
       WHERE c.tenant_id = ? AND c.source = ?
       GROUP BY c.id, c.external_id`,
      [SOURCE, admin.tenant_id, SOURCE]
    );
    const byExternal = new Map(linked.map((r) => [r.external_id, r]));
    return NextResponse.json({
      ...setup,
      guild: { id: guild.id, name: guild.name },
      channels: guild.channels.map((c) => ({
        id: c.id,
        name: c.name,
        appchatChannelId: byExternal.get(c.id)?.id ?? null,
        imported: Number(byExternal.get(c.id)?.imported ?? 0),
      })),
    });
  } catch (err) {
    return NextResponse.json({ ...setup, error: err.message }, { status: 400 });
  }
}
