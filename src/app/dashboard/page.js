import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth.js';
import { getUserTenants } from '@/lib/tenant.js';
import { query } from '@/lib/db.js';

function formatRelativeTime(value) {
  if (!value) return 'just now';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const tenants = await getUserTenants(user.id);
  const ownerCount = tenants.filter((tenant) => tenant.role === 'owner').length;
  const tenantIds = tenants.map((tenant) => tenant.id);

  let liveRooms = [];
  let activeChannels = [];

  if (tenantIds.length > 0) {
    const placeholders = tenantIds.map(() => '?').join(', ');

    liveRooms = await query(
      `SELECT r.id, r.name, r.livekit_room, r.status, r.started_at,
              t.slug AS tenant_slug, t.name AS tenant_name,
              c.name AS channel_name,
              (SELECT COUNT(*) FROM room_participants rp WHERE rp.room_id = r.id AND rp.left_at IS NULL) AS participant_count
       FROM rooms r
       JOIN tenants t ON t.id = r.tenant_id
       LEFT JOIN channels c ON c.id = r.channel_id
       WHERE r.tenant_id IN (${placeholders}) AND r.status IN ('waiting', 'active')
       ORDER BY r.started_at DESC
       LIMIT 6`,
      tenantIds
    );

    activeChannels = await query(
      `SELECT c.id, c.name, t.slug AS tenant_slug, t.name AS tenant_name,
              MAX(m.created_at) AS last_message_at,
              COUNT(m.id) AS recent_messages,
              COUNT(DISTINCT m.user_id) AS active_people
       FROM channels c
       JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ?
       JOIN tenants t ON t.id = c.tenant_id
       JOIN messages m ON m.channel_id = c.id
       WHERE c.tenant_id IN (${placeholders})
         AND m.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         AND m.type IN ('text', 'ai')
       GROUP BY c.id, c.name, t.slug, t.name
       ORDER BY last_message_at DESC
       LIMIT 6`,
      [user.id, ...tenantIds]
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-950 px-6 py-10 text-gray-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#d63031]/20 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-[#6c5ce7]/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-6 rounded-2xl border border-gray-800/80 bg-gray-900/80 px-5 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <img src="https://www.brandidentity.com/logo/appchat.com" alt="AppChat" className="h-7" />
              <span className="text-xs text-gray-500">Workspace Portal</span>
            </Link>

            <nav className="flex items-center gap-2 text-sm">
              <Link href="/dashboard" className="rounded-lg bg-[#d63031]/20 px-3 py-1.5 text-[#ff8f8f]">
                Dashboard
              </Link>
              <Link href="/onboard" className="rounded-lg px-3 py-1.5 text-gray-300 transition hover:bg-gray-800">
                New Workspace
              </Link>
              {user.is_admin ? (
                <Link href="/admin" className="rounded-lg px-3 py-1.5 text-gray-300 transition hover:bg-gray-800">
                  Admin
                </Link>
              ) : null}
              <Link href="/login" className="rounded-lg px-3 py-1.5 text-gray-300 transition hover:bg-gray-800">
                Switch Account
              </Link>
            </nav>
          </div>
        </header>

        <div className="rounded-3xl border border-gray-800/80 bg-gradient-to-br from-gray-900 to-gray-950 p-8 shadow-2xl shadow-black/40">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d63031]/30 bg-[#d63031]/10 px-3 py-1 text-xs font-medium text-[#ff8f8f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d63031]" />
            Workspace Hub
          </p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Welcome back{user.name ? `, ${user.name}` : ''}. Jump into your workspaces, manage access, and keep your teams moving.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={tenants[0] ? `/${tenants[0].slug}` : '/onboard'}
              className="rounded-xl bg-[#d63031] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#c0392b]"
            >
              {tenants[0] ? 'Open Last Workspace' : 'Create Workspace'}
            </Link>
            {user.is_admin ? (
              <Link
                href="/admin"
                className="rounded-xl border border-gray-700 bg-gray-900 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-500"
              >
                Admin Console
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total Workspaces</p>
            <p className="mt-2 text-3xl font-bold">{tenants.length}</p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Owner Access</p>
            <p className="mt-2 text-3xl font-bold">{ownerCount}</p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Account Type</p>
            <p className="mt-2 text-xl font-semibold">{user.is_admin ? 'Admin' : 'Member'}</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/70 p-6 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">Your Workspaces</h2>
            <span className="text-xs text-gray-500">{tenants.length} total</span>
          </div>
          {tenants.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-950/70 p-8 text-center text-sm text-gray-400">
              <p>You are not in any workspace yet.</p>
              <Link href="/onboard" className="mt-4 inline-block rounded-xl bg-[#d63031] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#c0392b]">
                Create Workspace
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {tenants.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/${tenant.slug}`}
                  className="group rounded-2xl border border-gray-800 bg-gray-950/80 p-4 transition hover:border-[#d63031]/40 hover:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{tenant.name}</p>
                      <p className="text-xs text-gray-500">/{tenant.slug}</p>
                    </div>
                    <span className="rounded-full bg-gray-800 px-2.5 py-1 text-[10px] uppercase text-gray-300">
                      {tenant.role}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-[#fdcb6e] opacity-0 transition group-hover:opacity-100">
                    Open workspace
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-gray-800 bg-gray-900/70 p-6">
            <h2 className="text-sm font-semibold text-gray-300">How It Works</h2>
            <div className="mt-4 space-y-3">
              {[
                { title: '1. Open a workspace', desc: 'Choose your team space and jump into a channel.' },
                { title: '2. Join live conversation', desc: 'See active channels and live rooms with real participants.' },
                { title: '3. Start or join a room', desc: 'Enter secure calls from channels and collaborate in real time.' },
              ].map((step) => (
                <div key={step.title} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="mt-1 text-xs text-gray-400">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-800 bg-gray-900/70 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">Latest Live Rooms</h2>
              <span className="text-xs text-gray-500">{liveRooms.length} active</span>
            </div>
            {liveRooms.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-700 bg-gray-950/70 p-4 text-xs text-gray-400">
                No live rooms right now.
              </p>
            ) : (
              <div className="space-y-2">
                {liveRooms.map((room) => (
                  <Link
                    key={room.id}
                    href={`/room/${room.livekit_room}`}
                    className="block rounded-2xl border border-gray-800 bg-gray-950/70 p-4 transition hover:border-[#00b894]/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{room.name || 'Live Room'}</p>
                      <span className="rounded-full bg-[#00b894]/15 px-2.5 py-1 text-[10px] uppercase text-[#00b894]">
                        {room.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {room.tenant_name}{room.channel_name ? ` • #${room.channel_name}` : ''} • {room.participant_count} in room
                    </p>
                    <p className="mt-1 text-[11px] text-gray-600">{formatRelativeTime(room.started_at)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">Active Channels (Real Conversations)</h2>
            <span className="text-xs text-gray-500">last 24h</span>
          </div>
          {activeChannels.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-700 bg-gray-950/70 p-4 text-xs text-gray-400">
              No channel activity in the last 24 hours.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {activeChannels.map((channel) => (
                <Link
                  key={channel.id}
                  href={`/${channel.tenant_slug}/c/${channel.id}`}
                  className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 transition hover:border-[#6c5ce7]/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                      #{channel.name}
                    </p>
                    <span className="rounded-full bg-gray-800 px-2.5 py-1 text-[10px] text-gray-300">
                      {channel.active_people} active
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{channel.tenant_name}</p>
                  <p className="mt-2 text-[11px] text-gray-600">
                    {channel.recent_messages} messages • {formatRelativeTime(channel.last_message_at)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {user.is_admin ? (
          <div className="mt-6 rounded-3xl border border-[#fdcb6e]/30 bg-gradient-to-r from-[#fdcb6e]/10 to-transparent p-6">
            <h2 className="text-sm font-semibold text-[#fdcb6e]">Admin Access</h2>
            <p className="mt-1 text-sm text-gray-300">System controls, tenant management, and platform-level insights.</p>
            <Link href="/admin" className="mt-4 inline-block rounded-xl bg-[#fdcb6e] px-4 py-2 text-sm font-medium text-gray-950 transition hover:opacity-90">
              Open Admin Panel
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
