'use client';

import { useState } from 'react';
import Link from 'next/link';

function upload(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/zip');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'));
    xhr.send(file);
  });
}

export default function SlackImport({ tenantSlug }) {
  const [phase, setPhase] = useState('pick'); // pick | uploading | reading | choose
  const [progress, setProgress] = useState(0);
  const [key, setKey] = useState(null);
  const [info, setInfo] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  async function onFile(file) {
    if (!file) return;
    setError('');
    setPhase('uploading');
    try {
      const res = await fetch('/api/admin/slack/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: tenantSlug, size: file.size }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start the upload');
      await upload(data.uploadUrl, file, setProgress);
      setKey(data.key);
      setPhase('reading');
      const r = await fetch(`/api/admin/slack?tenant=${encodeURIComponent(tenantSlug)}&key=${encodeURIComponent(data.key)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not read the export');
      setInfo(d);
      setSelected(new Set(d.channels.filter((c) => !c.archived && c.messages > 0).map((c) => c.id)));
      setPhase('choose');
    } catch (err) {
      setError(err.message);
      setPhase('pick');
    }
  }

  async function runImport() {
    setRunning(true);
    for (const c of info.channels.filter((ch) => selected.has(ch.id))) {
      setResults((r) => ({ ...r, [c.id]: { state: 'running' } }));
      try {
        const res = await fetch('/api/admin/slack/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant: tenantSlug, key, channelId: c.id }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Import failed');
        setResults((r) => ({ ...r, [c.id]: { state: 'done', imported: d.imported, channelId: d.channelId } }));
      } catch (err) {
        setResults((r) => ({ ...r, [c.id]: { state: 'error', message: err.message } }));
      }
    }
    setRunning(false);
  }

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-4 md:px-6 py-3 border-b border-gray-800 flex items-center gap-2">
        <button onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))} className="md:hidden p-1.5 -ml-1 rounded text-gray-400 hover:text-white" aria-label="Open channels">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <h1 className="font-semibold">Import from Slack</h1>
      </header>
      <div className="max-w-2xl p-4 md:p-6 space-y-6">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">1. Export your Slack workspace</h2>
          <p className="text-sm text-gray-400">
            In Slack: workspace name → Tools &amp; settings → Workspace settings → Import/Export Data → Export. Download the .zip when Slack emails you.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">2. Upload the export</h2>
          {phase === 'pick' && (
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-700 hover:border-[#4A154B] p-8 cursor-pointer text-sm text-gray-400">
              <span>Choose the Slack export .zip</span>
              <input type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          )}
          {phase === 'uploading' && (
            <div className="space-y-1">
              <p className="text-sm text-gray-400">Uploading… {Math.round(progress * 100)}%</p>
              <div className="h-1.5 rounded bg-gray-800 overflow-hidden"><div className="h-full bg-[#4A154B]" style={{ width: `${progress * 100}%` }} /></div>
            </div>
          )}
          {phase === 'reading' && <p className="text-sm text-gray-400">Reading the export…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </section>

        {phase === 'choose' && info && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">3. Choose channels</h2>
            <p className="text-sm text-gray-400">
              {info.users} people in the export{info.usersWithEmail ? `; ${info.usersWithEmail} include an email, so they'll show as their AppChat account if they're in this workspace` : ''}.
              Others keep their Slack name. Re-importing only adds messages that aren't here yet.
            </p>
            <ul className="rounded-xl border border-gray-800 divide-y divide-gray-800">
              {info.channels.map((c) => {
                const r = results[c.id];
                return (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} disabled={running} className="accent-[#4A154B]" />
                    <span className="flex-1 min-w-0 truncate">{c.isPrivate ? '🔒' : '#'} {c.name}{c.archived ? ' (archived)' : ''}</span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {r?.state === 'running' && 'Importing…'}
                      {r?.state === 'done' && <Link href={`/${tenantSlug}/c/${r.channelId}`} className="text-[#00b894] hover:underline">{r.imported} new · open</Link>}
                      {r?.state === 'error' && <span className="text-red-400">{r.message}</span>}
                      {!r && `${c.messages} messages${c.imported ? ` · ${c.imported} already here` : ''}`}
                    </span>
                  </li>
                );
              })}
            </ul>
            <button onClick={runImport} disabled={running || !selected.size} className="px-4 py-2 rounded-lg bg-[#4A154B] hover:bg-[#611f64] disabled:opacity-40 text-sm font-medium text-white">
              {running ? 'Importing…' : `Import ${selected.size} channel${selected.size === 1 ? '' : 's'}`}
            </button>
            <p className="text-xs text-gray-500">Slack file attachments are listed by name; the files themselves stay in Slack.</p>
          </section>
        )}
      </div>
    </div>
  );
}
