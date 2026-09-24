'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoster, PresenceDot, describePresence, localTime } from './presence.jsx';

// Discord-style member list on the right. Always visible on wide screens; a drawer
// (toggled by the header's People button) on phones and tablets.
export default function MemberList({ currentSlug, currentUserId }) {
  const roster = useRoster();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(null);
  const [filter, setFilter] = useState('');
  const [profile, setProfile] = useState(null);

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
        setProfile(null);
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
        onClick={() => setProfile(m)}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-gray-800/70"
        title={`View ${m.name}`}
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
      {profile && (
        <ProfileCard
          member={roster?.members?.find((x) => x.id === profile.id) || profile}
          isMe={profile.id === currentUserId}
          busy={opening === profile.id}
          onMessage={() => openDm(profile.id)}
          onClose={() => setProfile(null)}
        />
      )}
    </>
  );
}

function ProfileCard({ member: m, isMe, busy, onMessage, onClose }) {
  const time = localTime(m.timezone);
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={`${m.name}'s profile`}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="h-16 bg-gradient-to-r from-[#d63031]/60 to-[#6c5ce7]/60" />
        <div className="px-5 pb-5 -mt-8 space-y-3">
          <span className="relative inline-block">
            {m.avatar ? (
              <img src={m.avatar} alt="" className="w-16 h-16 rounded-full ring-4 ring-gray-900 object-cover bg-gray-800" />
            ) : (
              <span className="w-16 h-16 rounded-full ring-4 ring-gray-900 bg-gray-700 flex items-center justify-center text-xl font-bold">
                {(m.name || '?')[0].toUpperCase()}
              </span>
            )}
            <PresenceDot status={m.status} className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5" />
          </span>
          <div>
            <p className="text-lg font-semibold flex items-center gap-2">
              {m.name}
              {['owner', 'admin'].includes(m.role) && <span className="text-[10px] uppercase px-1.5 rounded bg-[#fdcb6e]/15 text-[#fdcb6e]">{m.role}</span>}
            </p>
            <p className="text-sm text-gray-400">{m.email}</p>
          </div>
          <div className="rounded-xl bg-gray-950 border border-gray-800 p-3 text-sm space-y-1">
            <p className="text-gray-200">{m.online ? (m.status === 'away' ? 'Away' : m.where?.label || 'Online') : 'Offline'}</p>
            <p className="text-xs text-gray-500">{time ? `${time} local time` : 'Local time unknown'}{!m.online ? ` · ${describePresence(m).split(' · ')[0]}` : ''}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onMessage} disabled={busy} className="flex-1 py-2 rounded-lg bg-[#00b894] hover:bg-[#00a383] disabled:opacity-50 text-sm font-medium text-white">
              {isMe ? 'Notes to self' : m.online ? 'Message' : 'Message (they’ll get an email)'}
            </button>
            {m.contribUrl && (
              <a href={m.contribUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm">
                contrib.com profile
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
