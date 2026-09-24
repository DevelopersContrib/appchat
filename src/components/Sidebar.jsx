'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import InstallAppButton from './InstallAppButton.jsx';
import { usePresenceBeacon, publishRoster, PresenceDot } from './presence.jsx';

const ROSTER_POLL_MS = 15000;

export default function Sidebar({ tenant, channels, dms: initialDms = [], user, role, currentSlug }) {
  const pathname = usePathname();
  const inChannel = pathname.includes('/c/');
  const currentChannelId = Number(pathname.match(/\/c\/(\d+)/)?.[1]) || null;
  const [roster, setRoster] = useState({ members: [], dms: initialDms, unread: {} });

  usePresenceBeacon({ tenant: currentSlug, channelId: currentChannelId });

  const loadRoster = useCallback(async () => {
    try {
      const res = await fetch(`/api/presence?tenant=${encodeURIComponent(currentSlug)}`);
      if (!res.ok) return;
      const data = await res.json();
      setRoster(data);
      publishRoster(data);
    } catch {}
  }, [currentSlug]);

  useEffect(() => {
    loadRoster();
    const timer = setInterval(loadRoster, ROSTER_POLL_MS);
    window.addEventListener('focus', loadRoster);
    window.addEventListener('appchat-dm-opened', loadRoster);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', loadRoster);
      window.removeEventListener('appchat-dm-opened', loadRoster);
    };
  }, [loadRoster]);

  // Reading a channel clears its badge right away instead of waiting for the next poll.
  useEffect(() => {
    if (currentChannelId) setRoster((r) => ({ ...r, unread: { ...r.unread, [currentChannelId]: 0 } }));
  }, [currentChannelId]);

  const membersById = Object.fromEntries(roster.members.map((m) => [m.id, m]));
  // On phones the sidebar is a drawer; it starts open on the workspace home, where there's nothing else to show.
  const [mobileOpen, setMobileOpen] = useState(!inChannel);
  const [showNewChannel, setShowNewChannel] = useState(false);

  useEffect(() => {
    const toggle = () => setMobileOpen((o) => !o);
    window.addEventListener('toggle-sidebar', toggle);
    return () => window.removeEventListener('toggle-sidebar', toggle);
  }, []);

  useEffect(() => {
    if (inChannel) setMobileOpen(false);
  }, [pathname, inChannel]);
  const [newName, setNewName] = useState('');

  async function createChannel(e) {
    e.preventDefault();
    if (!newName.trim()) return;

    await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant: currentSlug, name: newName.trim() }),
    });

    setNewName('');
    setShowNewChannel(false);
    window.location.reload();
  }

  return (
    <>
    {mobileOpen && inChannel && (
      <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
    )}
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-gray-800 bg-gray-900 transition-transform
        md:static md:w-64 md:translate-x-0 ${inChannel ? 'w-72' : 'w-full'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      style={{ borderColor: tenant.brand_color + '33', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="p-4 border-b border-gray-800 flex items-center gap-3">
        {tenant.logo_url && (
          <img src={tenant.logo_url} alt="" className="h-7 w-7 rounded" />
        )}
        <div>
          <h2 className="font-semibold text-sm">{tenant.name}</h2>
          <p className="text-xs text-gray-500">{role}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
          Channels
          {['owner', 'admin'].includes(role) && (
            <button
              onClick={() => setShowNewChannel(!showNewChannel)}
              className="text-gray-400 hover:text-white text-lg leading-none"
            >
              +
            </button>
          )}
        </p>

        {showNewChannel && (
          <form onSubmit={createChannel} className="px-2 mb-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="channel-name"
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </form>
        )}

        {channels.map((ch) => {
          const href = `/${currentSlug}/c/${ch.id}`;
          const active = pathname === href;
          const unread = roster.unread[ch.id] || 0;
          return (
            <Link
              key={ch.id}
              href={href}
              className={`flex items-center px-3 py-2 md:py-1.5 rounded text-sm transition ${
                active
                  ? 'bg-blue-600/20 text-blue-400'
                  : unread ? 'text-white font-semibold hover:bg-gray-800' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <span className="text-gray-600 mr-1">#</span>
              <span className="truncate">{ch.name}</span>
              {unread > 0 && !active && <UnreadBadge count={unread} />}
            </Link>
          );
        })}

        <p className="text-xs text-gray-500 uppercase tracking-wider px-2 pt-4 mb-2">Direct messages</p>
        {roster.dms.length === 0 && <p className="px-3 text-xs text-gray-600">Pick someone in the member list to message them.</p>}
        {roster.dms.map((dm) => {
          const href = `/${currentSlug}/c/${dm.id}`;
          const active = pathname === href;
          const unread = roster.unread[dm.id] || 0;
          const peer = membersById[dm.peer_id];
          const name = dm.peer_id === user.id ? `${dm.peer_name || dm.peer_email} (you)` : dm.peer_name || dm.peer_email;
          return (
            <Link
              key={dm.id}
              href={href}
              className={`flex items-center gap-2 px-3 py-2 md:py-1.5 rounded text-sm transition ${
                active ? 'bg-blue-600/20 text-blue-400' : unread ? 'text-white font-semibold hover:bg-gray-800' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <PresenceDot status={peer?.status || 'offline'} />
              <span className="truncate">{name}</span>
              {unread > 0 && !active && <UnreadBadge count={unread} />}
            </Link>
          );
        })}

      </nav>

      <div className="p-3 border-t border-gray-800">
        <InstallAppButton className="mb-3" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
            {(user.name || user.email)[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{user.name || user.email}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button title="Sign out" className="text-xs text-gray-500 hover:text-gray-200">Sign out</button>
          </form>
        </div>
      </div>
    </aside>
    </>
  );
}

function UnreadBadge({ count }) {
  return (
    <span className="ml-auto pl-2 shrink-0">
      <span className="inline-block min-w-[18px] px-1.5 rounded-full bg-[#d63031] text-white text-[10px] font-bold text-center leading-[18px]">
        {count > 99 ? '99+' : count}
      </span>
    </span>
  );
}
