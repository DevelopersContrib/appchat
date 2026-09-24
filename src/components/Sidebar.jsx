'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import InstallAppButton from './InstallAppButton.jsx';
import NotificationsButton from './NotificationsButton.jsx';
import { NewChannelDialog, BrowseChannelsDialog, ChannelSettingsDialog } from './ChannelDialogs.jsx';
import { usePresenceBeacon, publishRoster, PresenceDot } from './presence.jsx';

const ROSTER_POLL_MS = 15000;

export default function Sidebar({ tenant, channels, dms: initialDms = [], user, role, currentSlug }) {
  const pathname = usePathname();
  const router = useRouter();
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
  const [dialog, setDialog] = useState(null); // 'new' | 'browse'
  const [settingsFor, setSettingsFor] = useState(null);
  const [menu, setMenu] = useState(null); // { x, y, kind: 'channel' | 'dm', id, name }
  const isAdmin = ['owner', 'admin'].includes(role);

  useEffect(() => {
    const toggle = () => setMobileOpen((o) => !o);
    const openSettings = (e) => setSettingsFor(e.detail);
    window.addEventListener('toggle-sidebar', toggle);
    window.addEventListener('open-channel-settings', openSettings);
    return () => {
      window.removeEventListener('toggle-sidebar', toggle);
      window.removeEventListener('open-channel-settings', openSettings);
    };
  }, []);

  useEffect(() => {
    if (inChannel) setMobileOpen(false);
  }, [pathname, inChannel]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  // Right-click on desktop; press-and-hold on phones.
  function menuHandlers(kind, item) {
    let timer;
    const open = (x, y) => setMenu({ x: Math.min(x, window.innerWidth - 220), y: Math.min(y, window.innerHeight - 200), kind, ...item });
    return {
      onContextMenu: (e) => {
        e.preventDefault();
        open(e.clientX, e.clientY);
      },
      onTouchStart: (e) => {
        const t = e.touches[0];
        timer = setTimeout(() => open(t.clientX, t.clientY), 500);
      },
      onTouchEnd: () => clearTimeout(timer),
      onTouchMove: () => clearTimeout(timer),
    };
  }

  async function markRead(id) {
    await fetch(`/api/channels/${id}/read`, { method: 'POST' });
    setRoster((r) => ({ ...r, unread: { ...r.unread, [id]: 0 } }));
  }

  async function leaveChannel(id) {
    const res = await fetch(`/api/channels/${id}/members`, { method: 'DELETE' });
    if (res.ok) {
      if (currentChannelId === id) router.push(`/${currentSlug}`);
      router.refresh();
    }
  }

  async function closeDm(id) {
    const res = await fetch(`/api/dms/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRoster((r) => ({ ...r, dms: r.dms.filter((d) => d.id !== id) }));
      if (currentChannelId === id) router.push(`/${currentSlug}`);
    }
  }

  const rowClass = (active, unread) =>
    `group flex items-center gap-2 px-3 py-2 md:py-1.5 rounded text-sm transition ${
      active ? 'bg-blue-600/20 text-blue-400' : unread ? 'text-white font-semibold hover:bg-gray-800' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
    }`;

  const moreButton = (kind, item) => (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        setMenu({ x: Math.min(r.left, window.innerWidth - 220), y: r.bottom + 4, kind, ...item });
      }}
      className="ml-1 opacity-100 md:opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white px-1"
      aria-label="More options"
    >
      ⋯
    </button>
  );

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
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-sm truncate">{tenant.name}</h2>
          <p className="text-xs text-gray-500">{role}</p>
        </div>
        {isAdmin && (
          <Link href={`/${currentSlug}/settings`} title="Workspace settings" aria-label="Workspace settings" className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.3 4.3c.4-1.7 3-1.7 3.4 0a1.7 1.7 0 002.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 001 2.5c1.8.4 1.8 3 0 3.4a1.7 1.7 0 00-1 2.6c.9 1.5-.9 3.3-2.4 2.4a1.7 1.7 0 00-2.6 1c-.4 1.8-3 1.8-3.4 0a1.7 1.7 0 00-2.5-1c-1.6.9-3.3-.9-2.4-2.4a1.7 1.7 0 00-1.1-2.6c-1.7-.4-1.7-3 0-3.4a1.7 1.7 0 001.1-2.5c-.9-1.6.8-3.3 2.4-2.4a1.7 1.7 0 002.5-1.1z" />
              <circle cx="12" cy="12" r="3" strokeWidth={2} />
            </svg>
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
          Channels
          {role !== 'guest' && (
            <button onClick={() => setDialog('new')} className="text-gray-400 hover:text-white text-lg leading-none" title="Create a channel" aria-label="Create a channel">
              +
            </button>
          )}
        </p>

        {channels.map((ch) => {
          const href = `/${currentSlug}/c/${ch.id}`;
          const active = pathname === href;
          const unread = roster.unread[ch.id] || 0;
          return (
            <Link key={ch.id} href={href} className={rowClass(active, unread)} {...menuHandlers('channel', { id: ch.id, name: ch.name })}>
              <span className="text-gray-600 w-3 text-center shrink-0">{ch.is_private ? '🔒' : '#'}</span>
              <span className="truncate">{ch.name}</span>
              {unread > 0 && !active && <UnreadBadge count={unread} />}
              {moreButton('channel', { id: ch.id, name: ch.name })}
            </Link>
          );
        })}
        <button onClick={() => setDialog('browse')} className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300">
          Browse channels
        </button>

        <p className="text-xs text-gray-500 uppercase tracking-wider px-2 pt-4 mb-2">Direct messages</p>
        {roster.dms.length === 0 && <p className="px-3 text-xs text-gray-600">Pick someone in the member list to message them.</p>}
        {roster.dms.map((dm) => {
          const href = `/${currentSlug}/c/${dm.id}`;
          const active = pathname === href;
          const unread = roster.unread[dm.id] || 0;
          const peer = membersById[dm.peer_id];
          const name = dm.peer_id === user.id ? `${dm.peer_name || dm.peer_email} (you)` : dm.peer_name || dm.peer_email;
          return (
            <Link key={dm.id} href={href} className={rowClass(active, unread)} {...menuHandlers('dm', { id: dm.id, name })}>
              <PresenceDot status={peer?.status || 'offline'} />
              <span className="truncate">{name}</span>
              {unread > 0 && !active && <UnreadBadge count={unread} />}
              {moreButton('dm', { id: dm.id, name })}
            </Link>
          );
        })}

      </nav>

      <div className="p-3 border-t border-gray-800">
        <InstallAppButton className="mb-2" />
        <NotificationsButton className="mb-3" />
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

    {menu && (
      <div
        role="menu"
        className="fixed z-[70] w-52 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl py-1 text-sm"
        style={{ left: menu.x, top: menu.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-3 py-1.5 text-[11px] text-gray-500 truncate">{menu.kind === 'dm' ? menu.name : `#${menu.name}`}</p>
        {menu.kind === 'channel' && (
          <MenuItem onClick={() => { setSettingsFor(menu.id); setMenu(null); }}>Channel settings</MenuItem>
        )}
        <MenuItem onClick={() => { markRead(menu.id); setMenu(null); }}>Mark as read</MenuItem>
        {menu.kind === 'channel' && (
          <MenuItem danger onClick={() => { leaveChannel(menu.id); setMenu(null); }}>Leave channel</MenuItem>
        )}
        {menu.kind === 'dm' && (
          <MenuItem danger onClick={() => { closeDm(menu.id); setMenu(null); }}>Close conversation</MenuItem>
        )}
      </div>
    )}
    {dialog === 'new' && <NewChannelDialog tenantSlug={currentSlug} onClose={() => setDialog(null)} />}
    {dialog === 'browse' && <BrowseChannelsDialog tenantSlug={currentSlug} onClose={() => setDialog(null)} />}
    {settingsFor && <ChannelSettingsDialog channelId={settingsFor} tenantSlug={currentSlug} onClose={() => setSettingsFor(null)} />}
    </>
  );
}

function MenuItem({ children, onClick, danger }) {
  return (
    <button role="menuitem" onClick={onClick} className={`w-full text-left px-3 py-2 hover:bg-gray-800 ${danger ? 'text-red-400' : 'text-gray-200'}`}>
      {children}
    </button>
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
