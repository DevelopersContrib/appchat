'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function DiscordImport({ tenantSlug }) {
  const [setup, setSetup] = useState(null);
  const [guildId, setGuildId] = useState('');
  const [guild, setGuild] = useState(null);
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [progress, setProgress] = useState({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const stopRef = useRef(false);

  useEffect(() => {
    fetch(`/api/admin/discord?tenant=${encodeURIComponent(tenantSlug)}`).then((r) => r.json()).then(setSetup).catch(() => {});
  }, [tenantSlug]);

  const refreshSetup = () =>
    fetch(`/api/admin/discord?tenant=${encodeURIComponent(tenantSlug)}`).then((r) => r.json()).then(setSetup).catch(() => {});

  async function loadServer(e, id = guildId) {
    e?.preventDefault();
    setError('');
    setGuild(null);
    setGuildId(id);
    const res = await fetch(`/api/admin/discord?tenant=${encodeURIComponent(tenantSlug)}&guild=${encodeURIComponent(String(id).trim())}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || 'Could not load that server');
    setGuild(data.guild);
    setChannels(data.channels);
    setSelected(new Set(data.channels.map((c) => c.id)));
  }

  async function runImport() {
    setRunning(true);
    setError('');
    stopRef.current = false;
    for (const ch of channels.filter((c) => selected.has(c.id))) {
      let count = 0;
      setProgress((p) => ({ ...p, [ch.id]: { count, state: 'running' } }));
      try {
        for (;;) {
          if (stopRef.current) throw new Error('Stopped');
          const res = await fetch('/api/admin/discord/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenant: tenantSlug, guild: guild.id, channelId: ch.id, importedSoFar: count }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Import failed');
          count += data.imported;
          setProgress((p) => ({ ...p, [ch.id]: { count, state: data.done ? 'done' : 'running', channelId: data.channelId } }));
          if (data.done) break;
        }
      } catch (err) {
        setProgress((p) => ({ ...p, [ch.id]: { count, state: 'error', message: err.message } }));
        if (stopRef.current) break;
      }
    }
    setRunning(false);
  }

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-4 md:px-6 py-3 border-b border-gray-800 flex items-center gap-2">
        <button
          onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))}
          className="md:hidden p-1.5 -ml-1 rounded text-gray-400 hover:text-white"
          aria-label="Open channels"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <h1 className="font-semibold">Import from Discord</h1>
      </header>

      <div className="max-w-2xl p-4 md:p-6 space-y-6">
        {setup && !setup.configured && (
          <div className="rounded-xl border border-[#fdcb6e]/30 bg-[#fdcb6e]/5 p-4 text-sm text-gray-300">
            Discord import isn&apos;t switched on for this server yet. An AppChat admin needs to add the Discord bot settings
            (<code className="text-xs">DISCORD_BOT_TOKEN</code> and <code className="text-xs">DISCORD_CLIENT_ID</code>).
          </div>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">1. Add the AppChat bot to your Discord server</h2>
          <p className="text-sm text-gray-400">It only needs to read channels and message history. You can remove it after importing.</p>
          {setup?.inviteUrl ? (
            <a href={setup.inviteUrl} target="_blank" rel="noopener noreferrer"
              className="inline-block px-4 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-sm font-medium text-white">
              Add bot to Discord
            </a>
          ) : (
            <p className="text-xs text-gray-500">Bot invite link not available yet.</p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">2. Pick your Discord server</h2>
          {setup?.guilds?.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {setup.guilds.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => loadServer(null, g.id)}
                    disabled={running}
                    className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left text-sm ${guild?.id === g.id ? 'border-[#5865F2] bg-[#5865F2]/10' : 'border-gray-800 hover:border-gray-600'}`}
                  >
                    {g.icon ? <img src={g.icon} alt="" className="w-8 h-8 rounded-full" /> : <span className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center font-bold">{g.name[0]}</span>}
                    <span className="truncate">{g.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">
              Servers appear here after you add the bot (step 1).{' '}
              <button onClick={refreshSetup} className="text-[#8b93ff] hover:underline">Refresh</button>
            </p>
          )}
          <details className="text-sm text-gray-400">
            <summary className="cursor-pointer text-xs text-gray-500">Or enter a server ID</summary>
            <p className="my-2 text-xs">
              Discord → User Settings → Advanced → turn on Developer Mode, then right-click the server icon → Copy Server ID.
              In a browser it's also the first number in the address: discord.com/channels/<b>SERVER_ID</b>/…
            </p>
          <form onSubmit={loadServer} className="flex gap-2">
            <input
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              placeholder="e.g. 123456789012345678"
              inputMode="numeric"
              className="flex-1 min-w-0 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-base md:text-sm focus:outline-none focus:border-[#5865F2]"
            />
            <button disabled={!guildId.trim() || running} className="px-4 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-sm">
              Load channels
            </button>
          </form>
          </details>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </section>

        {guild && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">3. Choose channels from “{guild.name}”</h2>
            <p className="text-sm text-gray-400">
              Channels with the same name are merged into the existing AppChat channel. Running it again only brings in new messages.
            </p>
            <ul className="rounded-xl border border-gray-800 divide-y divide-gray-800">
              {channels.map((c) => {
                const p = progress[c.id];
                return (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} disabled={running} className="accent-[#5865F2]" />
                    <span className="flex-1 min-w-0 truncate"># {c.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {p?.state === 'running' && `Importing… ${p.count}`}
                      {p?.state === 'done' && (
                        <Link href={`/${tenantSlug}/c/${p.channelId}`} className="text-[#00b894] hover:underline">{p.count} new · open</Link>
                      )}
                      {p?.state === 'error' && <span className="text-red-400">{p.message}</span>}
                      {!p && (c.imported ? `${c.imported} already imported` : '')}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={runImport}
                disabled={running || selected.size === 0}
                className="px-4 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-40 text-sm font-medium text-white"
              >
                {running ? 'Importing…' : `Import ${selected.size} channel${selected.size === 1 ? '' : 's'}`}
              </button>
              {running && (
                <button onClick={() => { stopRef.current = true; }} className="px-4 py-2 rounded-lg bg-gray-800 text-sm">Stop</button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Discord file links expire after about a day, so old images from Discord may not open later.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
