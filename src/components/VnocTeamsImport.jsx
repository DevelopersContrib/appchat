'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function VnocTeamsImport({ tenantSlug }) {
  const [rows, setRows] = useState(null);
  const [domains, setDomains] = useState({});
  const [results, setResults] = useState({});
  const [invite, setInvite] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const base = `/api/workspace/${encodeURIComponent(tenantSlug)}/vnoc-teams`;

  useEffect(() => {
    fetch(base)
      .then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(new Error(d.error)))))
      .then((d) => {
        setRows(d.channels);
        setDomains(Object.fromEntries(d.channels.map((c) => [c.id, c.domain || ''])));
      })
      .catch((e) => setError(e.message || 'Could not load channels'));
  }, [base]);

  async function importOne(c) {
    const domain = (domains[c.id] || '').trim();
    if (!domain) return;
    setResults((r) => ({ ...r, [c.id]: { state: 'running' } }));
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: c.id, domain, invite }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Import failed');
      setResults((r) => ({ ...r, [c.id]: { state: 'done', ...d } }));
    } catch (err) {
      setResults((r) => ({ ...r, [c.id]: { state: 'error', message: err.message } }));
    }
  }

  async function importAll() {
    setRunning(true);
    for (const c of rows.filter((x) => (domains[x.id] || '').trim())) await importOne(c);
    setRunning(false);
  }

  const ready = rows?.filter((c) => (domains[c.id] || '').trim()).length || 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-4 md:px-6 py-3 border-b border-gray-800 flex items-center gap-2">
        <button onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))} className="md:hidden p-1.5 -ml-1 rounded text-gray-400 hover:text-white" aria-label="Open channels">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <h1 className="font-semibold">Import VNOC teams</h1>
      </header>
      <div className="max-w-3xl p-4 md:p-6 space-y-5">
        <p className="text-sm text-gray-400">
          Link each channel to its VNOC domain, then bring in that domain’s team (the owner and everyone on the team in VNOC).
          They’re added to the workspace and to that channel. We’ve guessed domains from channel names — check them before importing.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} className="accent-[#00b894] w-4 h-4" />
          Email people who are new to this workspace
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!rows && !error && <p className="text-sm text-gray-500">Looking up VNOC domains for your channels…</p>}
        {rows && (
          <>
            <ul className="rounded-xl border border-gray-800 divide-y divide-gray-800">
              {rows.map((c) => {
                const r = results[c.id];
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                    <span className="w-44 min-w-0 truncate">{c.isPrivate ? '🔒' : '#'} {c.name}</span>
                    <input
                      value={domains[c.id] || ''}
                      onChange={(e) => setDomains((d) => ({ ...d, [c.id]: e.target.value }))}
                      placeholder="domain.com"
                      className="flex-1 min-w-[140px] px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-base sm:text-sm focus:outline-none focus:border-[#00b894]"
                    />
                    <span className="w-28 text-xs text-gray-500 shrink-0">
                      {c.domain && domains[c.id] === c.domain ? `${c.teamSize} on team${c.suggested ? ' · guess' : ''}` : ''}
                    </span>
                    <span className="w-44 text-xs shrink-0 text-right">
                      {r?.state === 'running' && <span className="text-gray-400">Importing…</span>}
                      {r?.state === 'done' && (
                        <Link href={`/${tenantSlug}/c/${c.id}`} className="text-[#00b894] hover:underline">
                          +{r.addedToChannel} to channel{r.newToWorkspace ? ` · ${r.newToWorkspace} new` : ''}
                        </Link>
                      )}
                      {r?.state === 'error' && <span className="text-red-400">{r.message}</span>}
                      {!r && (
                        <button onClick={() => importOne(c)} disabled={running || !(domains[c.id] || '').trim()} className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40">
                          Import team
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <button onClick={importAll} disabled={running || !ready} className="px-4 py-2 rounded-lg bg-[#00b894] hover:bg-[#00a383] disabled:opacity-40 text-sm font-medium text-white">
              {running ? 'Importing…' : `Import teams for ${ready} channel${ready === 1 ? '' : 's'}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
