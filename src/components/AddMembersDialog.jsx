'use client';

import { useEffect, useState } from 'react';
import { Modal } from './ChannelDialogs.jsx';

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

/** Three ways to add people: email invites, a shareable join link, or a VNOC website's team. */
export default function AddMembersDialog({ tenantSlug, onClose, onAdded }) {
  const [tab, setTab] = useState('email');
  const [channels, setChannels] = useState([]);
  const base = `/api/workspace/${encodeURIComponent(tenantSlug)}`;

  useEffect(() => {
    api(`/api/channels?tenant=${encodeURIComponent(tenantSlug)}`)
      .then((rows) => setChannels(rows.filter((c) => !c.is_dm && !c.archived_at)))
      .catch(() => {});
  }, [tenantSlug]);

  return (
    <Modal title="Add members" onClose={onClose} wide>
      <div className="flex gap-1 mb-5 rounded-xl bg-gray-950 p-1 text-sm" role="tablist">
        {[
          ['email', 'Email'],
          ['link', 'Invite link'],
          ['vnoc', 'VNOC team'],
        ].map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`flex-1 py-1.5 rounded-lg ${tab === k ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'email' && <EmailTab base={base} onAdded={onAdded} />}
      {tab === 'link' && <LinkTab base={base} channels={channels} />}
      {tab === 'vnoc' && <VnocTab base={base} channels={channels} onAdded={onAdded} />}
    </Modal>
  );
}

function EmailTab({ base, onAdded }) {
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState('member');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setStatus(null);
    try {
      const d = await api(`${base}/members`, json('POST', { emails, role, message: note }));
      setEmails('');
      setNote('');
      setStatus({ ok: `Added ${d.added}, emailed ${d.emailed}${d.alreadyMembers ? `, ${d.alreadyMembers} already in` : ''}${d.invalid ? `, ${d.invalid} invalid` : ''}.` });
      onAdded?.();
    } catch (err) {
      setStatus({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={3} placeholder="Emails, separated by commas or new lines" className={input} />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Personal note (optional)" className={input} />
      <div className="flex gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
          <option value="guest">Guest</option>
        </select>
        <button onClick={send} disabled={busy || !emails.trim()} className={primary}>{busy ? 'Sending…' : 'Send invites'}</button>
      </div>
      <p className="text-xs text-gray-500">They get an email and can sign in right away with that address.</p>
      <Status status={status} />
    </div>
  );
}

function LinkTab({ base, channels }) {
  const [links, setLinks] = useState(null);
  const [days, setDays] = useState('7');
  const [maxUses, setMaxUses] = useState('');
  const [channelId, setChannelId] = useState('');
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState('');
  const [status, setStatus] = useState(null);

  const load = () => api(`${base}/invite-links`).then((d) => setLinks(d.links)).catch((e) => setStatus({ error: e.message }));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    setStatus(null);
    try {
      const d = await api(`${base}/invite-links`, json('POST', { expiresInDays: Number(days), maxUses: Number(maxUses) || 0, channelId: channelId || undefined }));
      setCreated(d.url);
      load();
    } catch (err) {
      setStatus({ error: err.message });
    }
  }

  async function copy(url) {
    try {
      if (navigator.share && /iphone|android/i.test(navigator.userAgent)) await navigator.share({ url, title: 'Join us on AppChat' });
      else await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(''), 2000);
    } catch {}
  }

  async function revoke(id) {
    await api(`${base}/invite-links?id=${id}`, { method: 'DELETE' }).catch(() => {});
    load();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Anyone with the link can sign in and join this workspace as a member.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select value={days} onChange={(e) => setDays(e.target.value)} className="px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
          <option value="1">Expires in 1 day</option>
          <option value="7">Expires in 7 days</option>
          <option value="30">Expires in 30 days</option>
          <option value="0">Never expires</option>
        </select>
        <select value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className="px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
          <option value="">Unlimited uses</option>
          <option value="1">1 use</option>
          <option value="10">10 uses</option>
          <option value="50">50 uses</option>
        </select>
        <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
          <option value="">Land in the workspace</option>
          {channels.map((c) => <option key={c.id} value={c.id}>Land in #{c.name}</option>)}
        </select>
      </div>
      <button onClick={create} className={primary}>Create link</button>
      {created && (
        <div className="flex items-center gap-2 rounded-xl border border-[#00b894]/40 bg-[#00b894]/5 p-3">
          <code className="flex-1 min-w-0 truncate text-xs">{created}</code>
          <button onClick={() => copy(created)} className="px-3 py-1.5 rounded-lg bg-[#00b894] text-xs text-white">{copied === created ? 'Copied' : 'Copy / share'}</button>
        </div>
      )}
      <Status status={status} />
      {links?.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Active links</p>
          <ul className="rounded-xl border border-gray-800 divide-y divide-gray-800 text-xs">
            {links.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-gray-300">…/join/{l.token.slice(0, 8)}…{l.channel_name ? ` → #${l.channel_name}` : ''}</span>
                  <span className="block text-gray-500">
                    {l.uses}{l.max_uses ? `/${l.max_uses}` : ''} joined · {l.expires_at ? `expires ${new Date(l.expires_at).toLocaleDateString()}` : 'no expiry'}
                  </span>
                </span>
                <button onClick={() => copy(l.url)} className="px-2 py-1 rounded bg-gray-800">{copied === l.url ? 'Copied' : 'Copy'}</button>
                <button onClick={() => revoke(l.id)} className="px-2 py-1 rounded text-red-400 hover:bg-red-500/10">Revoke</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VnocTab({ base, channels, onAdded }) {
  const [domain, setDomain] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [preview, setPreview] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [channelId, setChannelId] = useState('');
  const [invite, setInvite] = useState(true);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (domain.trim().length < 2 || preview?.domain === domain.trim()) return setSuggestions([]);
    const t = setTimeout(() => api(`${base}/vnoc-team?q=${encodeURIComponent(domain)}`).then((d) => setSuggestions(d.domains)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [domain, base, preview]);

  async function load(name = domain) {
    setStatus(null);
    setSuggestions([]);
    setDomain(name);
    try {
      const d = await api(`${base}/vnoc-team?domain=${encodeURIComponent(name.trim())}`);
      setPreview(d);
      setPicked(new Set(d.team.filter((p) => !p.alreadyMember).map((p) => p.email)));
    } catch (err) {
      setPreview(null);
      setStatus({ error: err.message });
    }
  }

  async function importTeam() {
    setBusy(true);
    setStatus(null);
    try {
      const d = await api(`${base}/vnoc-teams`, json('POST', { domain: preview.domain, channelId: channelId || undefined, emails: [...picked], invite }));
      setStatus({ ok: `Added ${d.newToWorkspace} new ${d.newToWorkspace === 1 ? 'person' : 'people'} to the workspace${channelId ? `, ${d.addedToChannel} to the channel` : ''}${d.emailed ? `, emailed ${d.emailed}` : ''}.` });
      onAdded?.();
      load(preview.domain);
    } catch (err) {
      setStatus({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  const toggle = (email) => setPicked((s) => { const n = new Set(s); n.has(email) ? n.delete(email) : n.add(email); return n; });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Pick a website to bring in its team from VNOC (the owner and everyone on the team).</p>
      <div className="relative flex gap-2">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && domain.trim() && load()}
          placeholder="e.g. zipsite.com"
          className={input}
        />
        <button onClick={() => load()} disabled={!domain.trim()} className="px-4 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-sm">Find team</button>
        {suggestions.length > 0 && (
          <ul className="absolute left-0 right-24 top-full mt-1 z-10 max-h-48 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
            {suggestions.map((s) => (
              <li key={s.domain_id}>
                <button onMouseDown={(e) => { e.preventDefault(); load(s.domain_name); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800">
                  {s.domain_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {preview && (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-medium">{preview.domain}</span>
            <span className="text-gray-500"> · {preview.team.length} {preview.team.length === 1 ? 'person' : 'people'} on the team</span>
          </p>
          {preview.team.length === 0 ? (
            <p className="text-sm text-gray-500">No team members with an email address in VNOC.</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto rounded-xl border border-gray-800 divide-y divide-gray-800">
              {preview.team.map((p) => (
                <li key={p.email}>
                  <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-800/60">
                    <input type="checkbox" checked={picked.has(p.email)} onChange={() => toggle(p.email)} className="accent-[#00b894]" />
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] uppercase text-gray-500">{p.role}</span>
                    <span className="ml-auto text-xs text-gray-500 truncate">{p.alreadyMember ? 'already in workspace' : p.email}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
            <option value="">Add to the workspace only</option>
            {channels.map((c) => <option key={c.id} value={c.id}>Also add to #{c.name} (and link it to {preview.domain})</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} className="accent-[#00b894] w-4 h-4" />
            Email people who are new to this workspace
          </label>
          <button onClick={importTeam} disabled={busy || picked.size === 0} className={primary}>
            {busy ? 'Adding…' : `Add ${picked.size} ${picked.size === 1 ? 'person' : 'people'}`}
          </button>
        </div>
      )}
      <Status status={status} />
    </div>
  );
}
