import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db.js';
import { withWorkspaceAdmin, saveSettings, audit } from '@/lib/workspace.js';
import { getDebrief, postDebrief, isLoopAgentConfigured } from '@/lib/loopagent.js';

// Debriefs contain network business data, so only AppChat platform admins can turn them on.
const platformAdminOnly = (user) => (user.is_admin ? null : NextResponse.json({ error: 'Only AppChat platform admins can set up LoopAgent debriefs' }, { status: 403 }));

export const GET = withWorkspaceAdmin(async (request, { user, settings }) => {
  return NextResponse.json({
    available: isLoopAgentConfigured() && Boolean(user.is_admin),
    channelId: settings.debriefChannelId || null,
    latest: user.is_admin && isLoopAgentConfigured() ? await getDebrief().catch(() => null) : null,
  });
});

// { channelId } to choose (or null to turn off); { postNow: true } to post the latest right away.
export const PUT = withWorkspaceAdmin(async (request, { user, tenant, settings }) => {
  const denied = platformAdminOnly(user);
  if (denied) return denied;
  const b = await request.json().catch(() => ({}));
  let channelId = settings.debriefChannelId || null;
  if (b.channelId !== undefined) {
    channelId = null;
    if (b.channelId) {
      const ch = await queryOne('SELECT id FROM channels WHERE id = ? AND tenant_id = ? AND is_dm = 0 AND archived_at IS NULL', [b.channelId, tenant.id]);
      if (!ch) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      channelId = ch.id;
    }
    await saveSettings(tenant.id, { ...settings, debriefChannelId: channelId });
    await audit(tenant.id, user.id, 'debrief.channel', channelId ? `channel ${channelId}` : 'off');
  }
  let posted = false;
  if (b.postNow && channelId) {
    const d = await getDebrief();
    if (d) posted = await postDebrief(channelId, d);
  }
  return NextResponse.json({ channelId, posted });
});
