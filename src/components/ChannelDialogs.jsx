'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoster } from './presence.jsx';

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full ${wide ? 'sm:max-w-lg' : 'sm:max-w-md'} max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none" aria-label="Close">×</button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const input = 'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-base sm:text-sm focus:outline-none focus:border-[#00b894]';

function MemberPicker({ selected, onChange, exclude = [] }) {
  const roster = useRoster();
  const [q, setQ] = useState('');
  const people = (roster?.members || []).filter(
    (m) => !exclude.includes(m.id) && (!q || m.name.toLowerCase().includes(q.toLowerCase()) || m.email.toLowerCase().includes(q.toLowerCase()))
  );
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className={input} />
      <ul className="max-h-48 overflow-y-auto rounded-lg border border-gray-800 divide-y divide-gray-800">
        {people.map((m) => (
          <li key={m.id}>
            <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-800/60">
              <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} className="accent-[#00b894]" />
              <span className="truncate">{m.name}</span>
              <span className="ml-auto text-xs text-gray-500 truncate">{m.email}</span>
            </label>
          </li>
        ))}
        {people.length === 0 && <li className="px-3 py-2 text-xs text-gray-500">No one found.</li>}
      </ul>
    </div>
  );
}

export function NewChannelDialog({ tenantSlug, onClose }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [memberIds, setMemberIds] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/channels', json('POST', { tenant: tenantSlug, name, description, isPrivate, memberIds }));
      onClose();
      router.push(data.url);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Create a channel" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs text-gray-400">Name</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-2 text-gray-500">#</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. marketing" className={`${input} pl-7`} />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400">Topic (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this channel about?" className={`${input} mt-1`} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            [false, 'Public', 'Anyone in the workspace can find and join'],
            [true, 'Private', 'Only people you invite'],
          ].map(([value, label, hint]) => (
            <button
              type="button"
              key={label}
              onClick={() => setIsPrivate(value)}
              className={`text-left rounded-xl border p-3 ${isPrivate === value ? 'border-[#00b894] bg-[#00b894]/10' : 'border-gray-700 hover:border-gray-600'}`}
            >
              <p className="text-sm font-medium">{value ? '🔒 ' : '# '}{label}</p>
              <p className="text-xs text-gray-400">{hint}</p>
            </button>
          ))}
        </div>
        {isPrivate && (
          <div>
            <label className="text-xs text-gray-400">Add people</label>
            <div className="mt-1"><MemberPicker selected={memberIds} onChange={setMemberIds} /></div>
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={!name.trim() || busy} className="w-full py-2.5 rounded-lg bg-[#00b894] hover:bg-[#00a383] disabled:opacity-40 text-sm font-medium text-white">
          {busy ? 'Creating…' : 'Create channel'}
        </button>
      </form>
    </Modal>
  );
}

export function BrowseChannelsDialog({ tenantSlug, onClose }) {
  const router = useRouter();
  const [channels, setChannels] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/api/channels/browse?tenant=${encodeURIComponent(tenantSlug)}`).then((d) => setChannels(d.channels)).catch((e) => setError(e.message));
  }, [tenantSlug]);

  async function join(id) {
    try {
      const data = await api(`/api/channels/${id}/members`, json('POST', {}));
      onClose();
      router.push(data.url);
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Browse channels" onClose={onClose}>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {!channels && !error && <p className="text-sm text-gray-500">Loading…</p>}
      {channels?.length === 0 && <p className="text-sm text-gray-500">You're already in every public channel.</p>}
      <ul className="space-y-2">
        {channels?.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-xl border border-gray-800 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium"># {c.name}</p>
              <p className="text-xs text-gray-500 truncate">{c.description || `${c.member_count} members`}</p>
            </div>
            <button onClick={() => join(c.id)} className="px-3 py-1.5 rounded-lg bg-[#00b894] text-xs font-medium text-white">Join</button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export function ChannelSettingsDialog({ channelId, tenantSlug, onClose }) {
  const router = useRouter();
  const [info, setInfo] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [adding, setAdding] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = () =>
    api(`/api/channels/${channelId}`)
      .then((d) => {
        setInfo(d);
        setName(d.name);
        setDescription(d.description || '');
        setIsPrivate(d.isPrivate);
      })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn, done) {
    setError('');
    setSaved('');
    try {
      const data = await fn();
      if (done) done(data);
    } catch (err) {
      setError(err.message);
    }
  }

  const save = () => run(() => api(`/api/channels/${channelId}`, json('PATCH', { name, description, isPrivate })), () => { setSaved('Saved'); router.refresh(); load(); });
  const addPeople = () => run(() => api(`/api/channels/${channelId}/members`, json('POST', { userIds: adding })), () => { setAdding([]); setShowAdd(false); load(); });
  const remove = (userId) => run(() => api(`/api/channels/${channelId}/members?userId=${userId}`, { method: 'DELETE' }), load);
  const leave = () => run(() => api(`/api/channels/${channelId}/members`, { method: 'DELETE' }), (d) => { onClose(); router.push(d.url); router.refresh(); });
  const archive = () => {
    if (!window.confirm(`Archive #${info.name}? It will disappear for everyone. History is kept.`)) return;
    run(() => api(`/api/channels/${channelId}`, { method: 'DELETE' }), (d) => { onClose(); router.push(d.url); router.refresh(); });
  };

  return (
    <Modal title={info ? `${info.isPrivate ? '🔒' : '#'} ${info.name}` : 'Channel settings'} onClose={onClose} wide>
      {!info && !error && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {info && (
        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <label className="text-xs text-gray-400">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={!info.canManage} className={`${input} mt-1 disabled:opacity-60`} />
            </div>
            <div>
              <label className="text-xs text-gray-400">Topic</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!info.canManage} className={`${input} mt-1 disabled:opacity-60`} />
            </div>
            {info.canManage && (
              <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 p-3 text-sm">
                <span>
                  <span className="block font-medium">Private channel</span>
                  <span className="block text-xs text-gray-400">Only members can see it. Making it public adds everyone.</span>
                </span>
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-[#00b894] w-5 h-5" />
              </label>
            )}
            {info.canManage && (
              <div className="flex items-center gap-3">
                <button onClick={save} className="px-4 py-2 rounded-lg bg-[#00b894] text-sm font-medium text-white">Save changes</button>
                {saved && <span className="text-xs text-[#00b894]">{saved}</span>}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Members ({info.members.length})</h3>
              {(info.isMember || info.canManage) && (
                <button onClick={() => setShowAdd((v) => !v)} className="text-xs text-[#00b894] hover:underline">+ Add people</button>
              )}
            </div>
            {showAdd && (
              <div className="space-y-2 rounded-xl border border-gray-800 p-3">
                <MemberPicker selected={adding} onChange={setAdding} exclude={info.members.map((m) => m.id)} />
                <button onClick={addPeople} disabled={!adding.length} className="px-3 py-1.5 rounded-lg bg-[#00b894] disabled:opacity-40 text-xs font-medium text-white">
                  Add {adding.length || ''}
                </button>
              </div>
            )}
            <ul className="max-h-60 overflow-y-auto rounded-xl border border-gray-800 divide-y divide-gray-800">
              {info.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="truncate">{m.name || m.email}{m.id === info.me ? ' (you)' : ''}</span>
                  <span className="text-xs text-gray-500 truncate">{m.name ? m.email : ''}</span>
                  {info.canManage && m.id !== info.me && (
                    <button onClick={() => remove(m.id)} className="ml-auto text-xs text-gray-500 hover:text-red-400">Remove</button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
            {info.isMember && (
              <button onClick={leave} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm">Leave channel</button>
            )}
            {info.canManage && (
              <button onClick={archive} className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm">Archive channel</button>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
