'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoster, PresenceDot } from './presence.jsx';

function formatWhen(d) {
  const date = new Date(d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

// Bold the searched words inside a result snippet.
function Highlight({ text, q }) {
  const words = (q.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || []).filter((w) => w.length >= 2);
  if (!words.length) return text;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return String(text).split(re).map((part, i) =>
    i % 2 ? <mark key={i} className="bg-[#fdcb6e]/25 text-white rounded px-0.5">{part}</mark> : part
  );
}

/** Search messages, files, people and channels across the workspace (Ctrl/⌘+K). */
export default function SearchDialog({ tenantSlug, channels, onClose, onOpenDm }) {
  const router = useRouter();
  const roster = useRoster();
  const inputRef = useRef(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('messages');
  const [channelId, setChannelId] = useState('');
  const [fromId, setFromId] = useState('');
  const [sort, setSort] = useState('relevant');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (tab !== 'messages' && tab !== 'files') return;
    if (q.trim().length < 2 && !fromId && !(tab === 'files' && channelId)) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ tenant: tenantSlug, q, type: tab, sort });
      if (channelId) params.set('channelId', channelId);
      if (fromId) params.set('fromId', fromId);
      try {
        const res = await fetch(`/api/search?${params}`);
        const d = await res.json();
        setResults(res.ok ? d.results : []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, tab, channelId, fromId, sort, tenantSlug]);

  function go(url) {
    onClose();
    router.push(url);
  }

  const needle = q.trim().toLowerCase();
  const people = (roster?.members || []).filter((m) => !needle || m.name.toLowerCase().includes(needle) || m.email.toLowerCase().includes(needle));
  const chans = channels.filter((c) => !needle || c.name.toLowerCase().includes(needle));

  const tabs = [['messages', 'Messages'], ['files', 'Files'], ['people', `People`], ['channels', 'Channels']];

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-0 sm:p-6 sm:pt-[10vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Search"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl h-dvh sm:h-auto sm:max-h-[75vh] flex flex-col sm:rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" /></svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search messages, files, people… (use "quotes" for a phrase)'
            className="flex-1 bg-transparent text-base sm:text-sm focus:outline-none placeholder:text-gray-500"
          />
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm px-1">Esc</button>
        </div>
        <div className="flex items-center gap-1 px-3 pt-2 border-b border-gray-800 overflow-x-auto">
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`shrink-0 px-3 py-2 text-sm border-b-2 -mb-px ${tab === k ? 'border-[#00b894] text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {(tab === 'messages' || tab === 'files') && (
          <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-gray-800 text-xs">
            <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg">
              <option value="">In: anywhere</option>
              {channels.map((c) => <option key={c.id} value={c.id}>In: #{c.name}</option>)}
            </select>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg">
              <option value="">From: anyone</option>
              {(roster?.members || []).map((m) => <option key={m.id} value={m.id}>From: {m.name}</option>)}
            </select>
            {tab === 'messages' && (
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg">
                <option value="relevant">Best match</option>
                <option value="recent">Newest first</option>
              </select>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {(tab === 'messages' || tab === 'files') && (
            <>
              {!results && !loading && <p className="p-4 text-sm text-gray-500">Type at least 2 characters.</p>}
              {loading && !results && <p className="p-4 text-sm text-gray-500">Searching…</p>}
              {results?.length === 0 && <p className="p-4 text-sm text-gray-500">No {tab} found.</p>}
              <ul>
                {results?.map((r) => (
                  <li key={`${r.id}-${r.file?.id || ''}`}>
                    <button onClick={() => go(r.url)} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-800/70">
                      <p className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="text-gray-300 font-medium">{r.author}</span>
                        <span>in {r.where}</span>
                        {r.source && <span className="px-1 rounded bg-gray-800 text-[10px] capitalize">{r.source}</span>}
                        {r.threadId && <span className="text-[10px]">· thread reply</span>}
                        <span className="ml-auto shrink-0">{formatWhen(r.createdAt)}</span>
                      </p>
                      {r.file ? (
                        <p className="mt-0.5 text-sm text-gray-200 truncate">📎 <Highlight text={r.file.title} q={q} /></p>
                      ) : (
                        <p className="mt-0.5 text-sm text-gray-200 line-clamp-3 whitespace-pre-wrap break-words"><Highlight text={r.body} q={q} /></p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === 'people' && (
            <ul>
              {people.map((m) => (
                <li key={m.id}>
                  <button onClick={() => { onClose(); onOpenDm(m.id); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-800/70 text-left">
                    <PresenceDot status={m.status} />
                    <span className="text-sm text-gray-200 truncate">{m.name}</span>
                    <span className="text-xs text-gray-500 truncate">{m.email}</span>
                    <span className="ml-auto text-xs text-[#00b894]">Message</span>
                  </button>
                </li>
              ))}
              {people.length === 0 && <li className="p-4 text-sm text-gray-500">No one found.</li>}
            </ul>
          )}

          {tab === 'channels' && (
            <ul>
              {chans.map((c) => (
                <li key={c.id}>
                  <button onClick={() => go(`/${tenantSlug}/c/${c.id}`)} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-800/70 text-left text-sm">
                    <span className="text-gray-500">{c.is_private ? '🔒' : '#'}</span>
                    <span className="text-gray-200">{c.name}</span>
                    {c.description && <span className="text-xs text-gray-500 truncate">{c.description}</span>}
                  </button>
                </li>
              ))}
              {chans.length === 0 && <li className="p-4 text-sm text-gray-500">No channels found. Browse channels to find ones you haven’t joined.</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
