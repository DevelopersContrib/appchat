'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AddMembersDialog from './AddMembersDialog.jsx';

const TABS = [
  ['general', 'General'],
  ['domain', 'Domain'],
  ['members', 'Members & roles'],
  ['rules', 'Rules'],
  ['moderation', 'Moderation'],
  ['tools', 'Tools'],
  ['email', 'Email'],
];

const input = 'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-base sm:text-sm focus:outline-none focus:border-[#00b894]';
const primary = 'px-4 py-2 rounded-lg bg-[#00b894] hover:bg-[#00a383] disabled:opacity-40 text-sm font-medium text-white';

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function Status({ status }) {
  if (!status) return null;
  return <p className={`text-sm ${status.error ? 'text-red-400' : 'text-[#00b894]'}`}>{status.error || status.ok}</p>;
}

export default function WorkspaceSettings({ tenantSlug, initialTab, channels, myId }) {
  const router = useRouter();
  const [tab, setTab] = useState(TABS.some(([k]) => k === initialTab) ? initialTab : 'general');
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const base = `/api/workspace/${encodeURIComponent(tenantSlug)}`;

  const loadSettings = useCallback(() => api(`${base}/settings`).then(setSettings).catch((e) => setStatus({ error: e.message })), [base]);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  function pick(key) {
    setTab(key);
    setStatus(null);
    window.history.replaceState(null, '', `?tab=${key}`);
  }

  async function saveSettings(patch) {
    setStatus(null);
    try {
      await api(`${base}/settings`, json('PUT', { ...settings, ...patch }));
      setSettings((s) => ({ ...s, ...patch }));
      setStatus({ ok: 'Saved' });
      router.refresh();
    } catch (err) {
      setStatus({ error: err.message });
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="px-4 md:px-6 py-3 border-b border-gray-800 flex items-center gap-2">
        <button onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))} className="md:hidden p-1.5 -ml-1 rounded text-gray-400 hover:text-white" aria-label="Open channels">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <h1 className="font-semibold">Workspace settings</h1>
      </header>
      <nav className="flex gap-1 overflow-x-auto px-4 md:px-6 border-b border-gray-800" aria-label="Settings sections">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => pick(key)}
            className={`shrink-0 px-3 py-2.5 text-sm border-b-2 -mb-px ${tab === key ? 'border-[#00b894] text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl p-4 md:p-6 space-y-6">
          {!settings && !status && <p className="text-sm text-gray-500">Loading…</p>}
          {settings && tab === 'general' && <General settings={settings} onSave={saveSettings} status={status} />}
          {tab === 'domain' && <Domain base={base} tenantSlug={tenantSlug} />}
          {tab === 'members' && <Members base={base} myId={myId} tenantSlug={tenantSlug} />}
          {settings && tab === 'rules' && <Rules settings={settings} onSave={saveSettings} status={status} />}
          {settings && tab === 'moderation' && <Moderation base={base} settings={settings} onSave={saveSettings} status={status} />}
          {tab === 'tools' && <Tools tenantSlug={tenantSlug} />}
          {settings && tab === 'email' && <Email base={base} settings={settings} onSave={saveSettings} status={status} channels={channels} />}
          {!settings && status && <Status status={status} />}
        </div>
      </div>
    </div>
  );
}

function General({ settings, onSave, status }) {
  const [f, setF] = useState({ name: settings.name, description: settings.description, logoUrl: settings.logoUrl || '', brandColor: settings.brandColor || '#2563eb', domain: settings.domain || '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <section className="space-y-4">
      <Field label="Workspace name"><input value={f.name} onChange={set('name')} className={input} /></Field>
      <Field label="Description"><textarea value={f.description} onChange={set('description')} rows={3} className={input} /></Field>
      <Field label="Domain" hint="Your VNOC domain. Used for the logo, file storage and sprints."><input value={f.domain} onChange={set('domain')} placeholder="example.com" className={input} /></Field>
      <Field label="Logo URL" hint="Leave blank to use the domain's logo."><input value={f.logoUrl} onChange={set('logoUrl')} placeholder="https://…" className={input} /></Field>
      <Field label="Brand color">
        <div className="flex items-center gap-3">
          <input type="color" value={f.brandColor} onChange={set('brandColor')} className="h-10 w-14 rounded bg-transparent" />
          <span className="text-sm text-gray-400">{f.brandColor}</span>
        </div>
      </Field>
      <button onClick={() => onSave(f)} className={primary}>Save</button>
      <Status status={status} />
    </section>
  );
}

function Members({ base, myId, tenantSlug }) {
  const [members, setMembers] = useState(null);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState(null);
  const load = useCallback(() => api(`${base}/members`).then((d) => setMembers(d.members)).catch((e) => setStatus({ error: e.message })), [base]);
  useEffect(() => { load(); }, [load]);

  async function run(fn, ok) {
    setStatus(null);
    try {
      const d = await fn();
      setStatus({ ok: typeof ok === 'function' ? ok(d) : ok });
      load();
    } catch (err) {
      setStatus({ error: err.message });
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 p-4">
        <div>
          <h2 className="text-sm font-semibold">Add members</h2>
          <p className="text-xs text-gray-400">Invite by email, share a join link, or bring in a VNOC website’s team.</p>
        </div>
        <button onClick={() => setAdding(true)} className={primary}>Add members</button>
      </div>
      {adding && <AddMembersDialog tenantSlug={tenantSlug} onClose={() => { setAdding(false); load(); }} onAdded={load} />}
      <Status status={status} />
      <ul className="rounded-xl border border-gray-800 divide-y divide-gray-800">
        {!members && <li className="p-3 text-sm text-gray-500">Loading…</li>}
        {members?.map((m) => {
          const muted = m.muted_until && new Date(m.muted_until) > new Date();
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">{m.name || m.email}{m.id === myId ? ' (you)' : ''}</p>
                <p className="text-xs text-gray-500 truncate">{m.email}{muted ? ` · muted until ${new Date(m.muted_until).toLocaleString()}` : ''}</p>
              </div>
              <select
                value={m.role}
                onChange={(e) => run(() => api(`${base}/members`, json('PATCH', { userId: m.id, role: e.target.value })), 'Role updated')}
                className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs"
              >
                {['owner', 'admin', 'member', 'guest'].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {m.id !== myId && (
                <>
                  <select
                    value=""
                    onChange={(e) => e.target.value && run(() => api(`${base}/members`, json('PATCH', { userId: m.id, muteMinutes: Number(e.target.value) })), Number(e.target.value) > 0 ? 'Muted' : 'Unmuted')}
                    className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs"
                  >
                    <option value="">{muted ? 'Muted' : 'Mute…'}</option>
                    <option value="60">1 hour</option>
                    <option value="1440">1 day</option>
                    <option value="10080">1 week</option>
                    {muted && <option value="-1">Unmute</option>}
                  </select>
                  <button
                    onClick={() => window.confirm(`Remove ${m.email} from this workspace?`) && run(() => api(`${base}/members?userId=${m.id}`, { method: 'DELETE' }), 'Removed')}
                    className="px-2 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10"
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Rules({ settings, onSave, status }) {
  const [rules, setRules] = useState(settings.rules);
  const [requireRules, setRequireRules] = useState(settings.requireRules);
  return (
    <section className="space-y-4">
      <Field label="Workspace rules" hint="Shown to members. Plain text; one rule per line works well.">
        <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={10} placeholder={'1. Be respectful.\n2. No spam or self-promotion.\n3. Keep client info confidential.'} className={input} />
      </Field>
      <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 p-3 text-sm">
        <span>
          <span className="block font-medium">Members must accept the rules</span>
          <span className="block text-xs text-gray-400">Shown before they can enter. Editing the rules asks everyone again.</span>
        </span>
        <input type="checkbox" checked={requireRules} onChange={(e) => setRequireRules(e.target.checked)} className="accent-[#00b894] w-5 h-5" />
      </label>
      <button onClick={() => onSave({ rules, requireRules })} className={primary}>Save rules</button>
      <Status status={status} />
    </section>
  );
}

function Moderation({ base, settings, onSave, status }) {
  const [words, setWords] = useState((settings.bannedWords || []).join(', '));
  const [log, setLog] = useState(null);
  useEffect(() => { api(`${base}/audit`).then((d) => setLog(d.entries)).catch(() => setLog([])); }, [base]);
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <Field label="Blocked words" hint="Comma-separated. They're replaced with **** when someone posts.">
          <textarea value={words} onChange={(e) => setWords(e.target.value)} rows={3} className={input} />
        </Field>
        <button onClick={() => onSave({ bannedWords: words.split(',').map((w) => w.trim()).filter(Boolean) })} className={primary}>Save</button>
        <Status status={status} />
      </div>
      <div className="rounded-xl border border-gray-800 p-4 text-sm text-gray-400 space-y-1">
        <p className="text-gray-200 font-medium">Moderator tools</p>
        <p>• Delete any message: hover a message (or press and hold on a phone) and choose Delete.</p>
        <p>• Mute or remove people: Members &amp; roles tab.</p>
        <p>• Archive a channel: right-click it in the sidebar → Channel settings.</p>
      </div>
      <div>
        <h2 className="text-sm font-semibold mb-2">Activity log</h2>
        <ul className="rounded-xl border border-gray-800 divide-y divide-gray-800 text-sm">
          {!log && <li className="p-3 text-gray-500">Loading…</li>}
          {log?.length === 0 && <li className="p-3 text-gray-500">Nothing yet.</li>}
          {log?.map((e) => (
            <li key={e.id} className="p-3">
              <p className="text-gray-200">{e.actor_name || e.actor_email || 'System'} · <span className="text-gray-400">{e.action.replace('.', ' ')}</span> {e.target && <span className="text-gray-300">{e.target}</span>}</p>
              <p className="text-xs text-gray-500">{new Date(e.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Tools({ tenantSlug }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Import</h2>
      <Link href={`/${tenantSlug}/import/vnoc`} className="flex items-center gap-3 rounded-xl border border-gray-800 p-4 hover:border-[#00b894]/60">
        <span className="w-9 h-9 rounded-lg bg-[#00b894] flex items-center justify-center text-white font-bold">V</span>
        <span>
          <span className="block text-sm font-medium">Import VNOC teams</span>
          <span className="block text-xs text-gray-400">Link channels to VNOC domains and add each domain’s team members.</span>
        </span>
      </Link>
      <Link href={`/${tenantSlug}/import/discord`} className="flex items-center gap-3 rounded-xl border border-gray-800 p-4 hover:border-[#5865F2]/60">
        <span className="w-9 h-9 rounded-lg bg-[#5865F2] flex items-center justify-center text-white font-bold">D</span>
        <span>
          <span className="block text-sm font-medium">Import from Discord</span>
          <span className="block text-xs text-gray-400">Bring in channels and message history from a Discord server.</span>
        </span>
      </Link>
      <Link href={`/${tenantSlug}/import/slack`} className="flex items-center gap-3 rounded-xl border border-gray-800 p-4 hover:border-[#4A154B]/80">
        <span className="w-9 h-9 rounded-lg bg-[#4A154B] flex items-center justify-center text-white font-bold">S</span>
        <span>
          <span className="block text-sm font-medium">Import from Slack</span>
          <span className="block text-xs text-gray-400">Upload a Slack workspace export (.zip) to bring in channels and messages.</span>
        </span>
      </Link>
    </section>
  );
}

function Email({ base, settings, onSave, status, channels }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [channelId, setChannelId] = useState('');
  const [sendStatus, setSendStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function announce() {
    if (!window.confirm('Email this announcement to everyone in the workspace?')) return;
    setBusy(true);
    setSendStatus(null);
    try {
      const d = await api(`${base}/announce`, json('POST', { subject, message, channelId: channelId || undefined }));
      setSendStatus({ ok: `Sent to ${d.sent} of ${d.total} members.` });
      setSubject('');
      setMessage('');
    } catch (err) {
      setSendStatus({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <Toggle
          label="Email direct messages to people who are offline"
          hint="At most one email per conversation every 15 minutes. People can turn this off for themselves."
          checked={settings.emailOfflineDms}
          onChange={(v) => onSave({ emailOfflineDms: v })}
        />
        <Toggle
          label="Daily “what you missed” digest"
          hint="One email a day with unread direct messages and @mentions."
          checked={settings.emailDigest}
          onChange={(v) => onSave({ emailDigest: v })}
        />
        <Status status={status} />
      </div>
      <div className="space-y-3 rounded-xl border border-gray-800 p-4">
        <h2 className="text-sm font-semibold">Send an announcement</h2>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={input} />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Message" className={input} />
        <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
          <option value="">Email only</option>
          {channels.map((c) => <option key={c.id} value={c.id}>Email + post in #{c.name}</option>)}
        </select>
        <div><button onClick={announce} disabled={busy || !subject.trim() || !message.trim()} className={primary}>{busy ? 'Sending…' : 'Send to everyone'}</button></div>
        <Status status={sendStatus} />
      </div>
      <div className="rounded-xl border border-dashed border-gray-800 p-4 text-sm text-gray-400">
        <p className="text-gray-200 font-medium">Email into a channel — coming next</p>
        <p>Each channel will get its own address; forwarded emails will post into the channel.</p>
      </div>
    </section>
  );
}

function Domain({ base, tenantSlug }) {
  const [info, setInfo] = useState(null);
  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((check) => api(`${base}/domain${check ? '?check=1' : ''}`).then((d) => { setInfo(d); setDomain(d.domain || ''); }).catch((e) => setStatus({ error: e.message })), [base]);
  useEffect(() => { load(); }, [load]);

  async function act(fn, ok) {
    setBusy(true);
    setStatus(null);
    try {
      const d = await fn();
      if (d) setInfo(d);
      setStatus(ok ? { ok } : null);
    } catch (err) {
      setStatus({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  const save = () => act(() => api(`${base}/domain`, json('PUT', { domain })), 'Domain saved. Add the DNS record below.');
  const check = () => act(() => api(`${base}/domain?check=1`), null);
  const remove = () => window.confirm(`Stop using ${info.domain}?`) && act(async () => { await api(`${base}/domain`, { method: 'DELETE' }); setDomain(''); return { domain: null, automatic: info.automatic }; }, 'Domain removed');

  if (!info) return <p className="text-sm text-gray-500">Loading…</p>;
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-gray-300">
          Give this workspace its own address, like <span className="text-white">team.vnoc.com</span>. People who open it land straight in this workspace, and it installs on phones as its own app.
        </p>
        <p className="text-xs text-gray-500">It will always also work at www.appchat.com/{tenantSlug}.</p>
      </div>
      <div className="flex gap-2">
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="team.example.com" className={input} />
        <button onClick={save} disabled={busy || !domain.trim() || domain.trim() === info.domain} className={primary}>{info.domain ? 'Change' : 'Add'}</button>
      </div>
      <Status status={status} />

      {info.domain && (
        <div className="rounded-xl border border-gray-800 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{info.domain}</p>
              <p className={`text-xs ${info.live ? 'text-[#00b894]' : 'text-[#fdcb6e]'}`}>
                {!info.automatic ? 'Saved — waiting for an AppChat admin to connect it' : info.live ? 'Live' : info.verified ? 'Waiting for DNS' : 'Waiting for verification'}
              </p>
            </div>
            <div className="flex gap-2">
              {info.automatic && !info.live && <button onClick={check} disabled={busy} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs">Check again</button>}
              {info.live && <a href={`https://${info.domain}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-[#00b894] text-xs text-white">Open</a>}
              <button onClick={remove} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10">Remove</button>
            </div>
          </div>
          {info.records?.length > 0 && !info.live && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Add {info.records.length === 1 ? 'this record' : 'these records'} where the domain's DNS is managed (for vnoc.com that's Cloudflare — set the proxy to “DNS only”):</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-gray-500"><tr><th className="text-left py-1 pr-3">Type</th><th className="text-left py-1 pr-3">Name</th><th className="text-left py-1">Value</th></tr></thead>
                  <tbody className="font-mono">
                    {info.records.map((r, i) => (
                      <tr key={i} className="border-t border-gray-800">
                        <td className="py-1.5 pr-3">{r.type}</td>
                        <td className="py-1.5 pr-3">{r.name}</td>
                        <td className="py-1.5 break-all">{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500">DNS changes usually take a few minutes. HTTPS is set up automatically once the record is in place.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 p-3 text-sm">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#00b894] w-5 h-5 shrink-0" />
    </label>
  );
}
