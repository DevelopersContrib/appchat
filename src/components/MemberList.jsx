'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoster, PresenceDot, describePresence } from './presence.jsx';

// Discord-style member list on the right. Always visible on wide screens; a drawer
// (toggled by the header's People button) on phones and tablets.
export default function MemberList({ currentSlug, currentUserId }) {
  const roster = useRoster();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener('toggle-members', toggle);
    return () => window.removeEventListener('toggle-members', toggle);
  }, []);

  async function openDm(memberId) {
    setOpening(memberId);
    try {
      const res = await fetch('/api/dms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: currentSlug, userId: memberId }),
      });
      const data = await res.json();
      if (res.ok) {
        setOpen(false);
        router.push(data.url);
        window.dispatchEvent(new Event('appchat-dm-opened'));
      }
    } finally {
      setOpening(null);
    }
  }

  const q = filter.trim().toLowerCase();
  const members = (roster?.members || []).filter(
    (m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  );
  const online = members.filter((m) => m.online);
  const offline = members.filter((m) => !m.online);

  const row = (m) => (
    <li key={m.id}>
      <button
        onClick={() => openDm(m.id)}
        disabled={opening === m.id}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-gray-800/70 disabled:opacity-60"
        title={m.id === currentUserId ? 'Notes to self' : `Message ${m.name}`}
      >
        <span className="relative shrink-0">
          {m.avatar ? (
            <img src={m.avatar} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <span className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-200">
              {(m.name || '?')[0].toUpperCase()}
            </span>
          )}
          <PresenceDot status={m.status} className="absolute -bottom-0.5 -right-0.5" />
        </span>
        <span className="min-w-0">
          <span className={`flex items-center gap-1.5 text-sm truncate ${m.online ? 'text-gray-100' : 'text-gray-500'}`}>
            <span className="truncate">{m.name}{m.id === currentUserId ? ' (you)' : ''}</span>
            {['owner', 'admin'].includes(m.role) && (
              <span className="text-[9px] uppercase px-1 rounded bg-[#fdcb6e]/15 text-[#fdcb6e] shrink-0">{m.role}</span>
            )}
          </span>
          <span className="block text-[11px] text-gray-500 truncate">{describePresence(m)}</span>
        </span>
      </button>
    </li>
  );

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-72 flex flex-col bg-gray-900 border-l border-gray-800 transition-transform
          lg:static lg:w-60 lg:translate-x-0 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Members"
      >
        <div className="p-3 border-b border-gray-800 flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find a member"
            className="flex-1 min-w-0 px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-base lg:text-xs focus:outline-none focus:border-[#00b894]"
          />
          <button onClick={() => setOpen(false)} className="lg:hidden text-gray-400 hover:text-white text-xl px-1" aria-label="Close">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {!roster && <p className="px-2 text-xs text-gray-500">Loading members…</p>}
          {online.length > 0 && (
            <>
              <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Online — {online.length}</p>
              <ul>{online.map(row)}</ul>
            </>
          )}
          {offline.length > 0 && (
            <>
              <p className="px-2 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Offline — {offline.length}</p>
              <ul>{offline.map(row)}</ul>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
