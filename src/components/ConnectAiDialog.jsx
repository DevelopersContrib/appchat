'use client';

import { useEffect, useState } from 'react';
import { Modal } from './ChannelDialogs.jsx';

const MCP_URL = 'https://www.appchat.com/api/mcp';

function Copy({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="shrink-0 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px]"
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function Snippet({ label, text }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-400">{label}</p>
      <div className="flex items-start gap-2 rounded-lg bg-gray-950 border border-gray-800 p-2">
        <pre className="flex-1 min-w-0 overflow-x-auto text-[11px] text-gray-300 whitespace-pre-wrap break-all">{text}</pre>
        <Copy text={text} />
      </div>
    </div>
  );
}

/** Personal connection keys so Claude (and other MCP clients) can use AppChat as you. */
export default function ConnectAiDialog({ onClose }) {
  const [tokens, setTokens] = useState(null);
  const [name, setName] = useState('Claude');
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');

  const load = () => fetch('/api/tokens').then((r) => r.json()).then((d) => setTokens(d.tokens || [])).catch(() => setTokens([]));
  useEffect(() => { load(); }, []);

  async function create() {
    setError('');
    const res = await fetch('/api/tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setError(d.error || 'Could not create a key');
    setCreated(d.token);
    load();
  }

  async function revoke(id) {
    await fetch(`/api/tokens?id=${id}`, { method: 'DELETE' });
    load();
  }

  const key = created || 'appc_YOUR_KEY';
  return (
    <Modal title="Connect Claude / AI assistants" onClose={onClose} wide>
      <div className="space-y-5 text-sm">
        <p className="text-gray-400">
          Let an AI assistant read your channels, search messages, post as you, see who’s online, and add VNOC tasks.
          It only sees what you can see. Revoke a key any time.
        </p>

        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. Claude on laptop)" className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-base sm:text-sm" />
          <button onClick={create} className="px-4 py-2 rounded-lg bg-[#00b894] hover:bg-[#00a383] text-sm font-medium text-white">Create key</button>
        </div>
        {error && <p className="text-red-400">{error}</p>}

        {created && (
          <div className="rounded-xl border border-[#fdcb6e]/40 bg-[#fdcb6e]/5 p-3 space-y-2">
            <p className="text-[#fdcb6e] text-xs font-medium">Copy your key now — it won’t be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-xs">{created}</code>
              <Copy text={created} />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-300">Set it up</p>
          <Snippet label="Claude Code (terminal)" text={`claude mcp add --transport http appchat ${MCP_URL} --header "Authorization: Bearer ${key}"`} />
          <Snippet
            label="Claude Desktop — Settings → Developer → Edit config, add under mcpServers"
            text={JSON.stringify({ appchat: { command: 'npx', args: ['-y', 'mcp-remote', MCP_URL, '--header', `Authorization: Bearer ${key}`] } }, null, 2)}
          />
          <Snippet label="Any MCP client (Streamable HTTP)" text={`URL: ${MCP_URL}\nHeader: Authorization: Bearer ${key}`} />
          <div className="rounded-lg border border-gray-800 p-3 space-y-1">
            <p className="text-xs font-semibold text-gray-300">claude.ai or the ChatGPT app — no key needed</p>
            <p className="text-xs text-gray-400">
              claude.ai: Settings → Connectors → Add custom connector. ChatGPT: Settings → Connectors (developer mode) → Create.
              Use the URL below; you’ll be asked to sign in to AppChat and click Allow.
            </p>
            <div className="flex items-center gap-2"><code className="flex-1 text-xs">{MCP_URL}</code><Copy text={MCP_URL} /></div>
          </div>
        </div>

        {tokens?.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">Your keys</p>
            <ul className="rounded-xl border border-gray-800 divide-y divide-gray-800 text-xs">
              {tokens.map((t) => (
                <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 min-w-0">
                    <span className="block text-gray-200">{t.name}{t.oauth_client_id ? ' · connected app' : ''}</span>
                    <span className="block text-gray-500">{t.token_prefix}… · {t.last_used_at ? `last used ${new Date(t.last_used_at).toLocaleString()}` : 'never used'}</span>
                  </span>
                  <button onClick={() => revoke(t.id)} className="px-2 py-1 rounded text-red-400 hover:bg-red-500/10">Revoke</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
