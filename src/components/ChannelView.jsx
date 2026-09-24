'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';
import SprintPanel from './SprintPanel.jsx';
import ThreadPanel from './ThreadPanel.jsx';
import { useRoster, PresenceDot, describePresence } from './presence.jsx';
import { celebrate } from '@/lib/celebrate.js';
import { isCelebration } from '@/lib/emoji-data.js';

function mergeUniqueMessages(existing, incoming) {
  const map = new Map();
  const getIdKey = (msg) =>
    String(msg?.id ?? `${msg?.created_at ?? ''}-${msg?.user_id ?? 'u'}-${msg?.body ?? ''}`);

  for (const msg of existing) {
    map.set(getIdKey(msg), msg);
  }

  for (const msg of incoming) {
    map.set(getIdKey(msg), msg);
  }

  return Array.from(map.values()).sort((a, b) => {
    const t1 = new Date(a.created_at).getTime();
    const t2 = new Date(b.created_at).getTime();
    if (t1 !== t2) return t1 - t2;
    return Number(a.id) - Number(b.id);
  });
}

export default function ChannelView({ channel, initialMessages, members, currentUser, tenantSlug, dmPeer, canModerate, focusId, initialThreadId }) {
  const roster = useRoster();
  const peerPresence = dmPeer ? roster?.members?.find((m) => m.id === dmPeer.id) : null;
  const [messages, setMessages] = useState(() => mergeUniqueMessages([], initialMessages || []));
  const pollRef = useRef(null);
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [sprintPanel, setSprintPanel] = useState({ open: false, query: '' });
  const [commandError, setCommandError] = useState('');
  const messagesRef = useRef(messages);
  const [hasEarlier, setHasEarlier] = useState((initialMessages || []).length >= 100 || Boolean(focusId));
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [threadFor, setThreadFor] = useState(initialThreadId || null);
  const [typing, setTyping] = useState([]);
  // Server clock of the last sync, so the next one only returns what changed since.
  const sinceRef = useRef(null);

  async function loadEarlier() {
    const oldest = messagesRef.current.find((m) => !String(m.id).startsWith('temp-'));
    if (!oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const res = await fetch(`/api/channels/${channel.id}/messages?before=${oldest.id}`);
      if (res.ok) {
        const older = await res.json();
        setHasEarlier(older.length >= 100);
        setMessages((prev) => mergeUniqueMessages(prev, older));
      }
    } finally {
      setLoadingEarlier(false);
    }
  }

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Live sync: new messages, plus edits/deletes/reactions/thread counts since the last sync, plus who's typing.
  const pollMessages = useCallback(async () => {
    const current = messagesRef.current || [];
    const lastId = current.reduce((max, msg) => Math.max(max, Number(msg.id) || 0), 0);
    try {
      const since = sinceRef.current ? `&since=${sinceRef.current}` : '';
      const res = await fetch(`/api/channels/${channel.id}/messages?after=${lastId}${since}`);
      if (!res.ok) return;
      const { messages: fresh = [], changed = [], typing: typingNow = [], now } = await res.json();
      sinceRef.current = now;
      setTyping(typingNow);
      if (fresh.some((m) => {
        const card = typeof m.metadata === 'string' ? JSON.parse(m.metadata || '{}').card : m.metadata?.card;
        return card?.kind === 'kudos' || isCelebration(m.body);
      })) celebrate();
      if (fresh.length || changed.length) {
        setMessages((prev) => {
          const removed = new Set(changed.filter((m) => m.deleted).map((m) => m.id));
          const loaded = new Set(prev.map((m) => m.id));
          const updates = changed.filter((m) => !m.deleted && loaded.has(m.id));
          return mergeUniqueMessages(prev.filter((m) => !removed.has(m.id)), [...fresh, ...updates]);
        });
      }
    } catch {}
  }, [channel.id]);

  const upsert = (msg) => setMessages((prev) => mergeUniqueMessages(prev, [msg]));

  async function handleReact(msg, emoji) {
    const res = await fetch(`/api/channels/${channel.id}/messages/${msg.id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
    if (res.ok) upsert(await res.json());
  }

  async function handleVote(msg, option) {
    const res = await fetch(`/api/channels/${channel.id}/messages/${msg.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option }),
    });
    if (res.ok) upsert(await res.json());
  }

  function handleEdit(msg) {
    setReplyTo(null);
    setEditing(msg);
  }

  function handleReply(msg) {
    setEditing(null);
    setReplyTo(msg);
  }

  // Viewing an older spot (from search): don't stream newer history in; "Jump to latest" goes live again.
  useEffect(() => {
    if (focusId) return;
    pollMessages();
    pollRef.current = setInterval(pollMessages, 1200);
    return () => clearInterval(pollRef.current);
  }, [pollMessages, focusId]);

  // The Brand Agent lives in channels, not in direct messages.
  useEffect(() => {
    if (dmPeer) return;
    fetch(`/api/channels/${channel.id}/agent`, { method: 'POST' }).catch(() => {});
  }, [channel.id, dmPeer]);

  const [meetMenu, setMeetMenu] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Google Meet: starts now unless `start` is given; bounces through Google sign-in the first time.
  async function startMeet(opts = {}) {
    setMeetMenu(false);
    setCommandError('');
    let timeZone;
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
    const res = await fetch(`/api/channels/${channel.id}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...opts, timeZone }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.needsGoogle) {
      window.location.href = data.authUrl;
      return;
    }
    if (!res.ok) return setCommandError(data.error || 'Could not create the Google Meet');
    if (!opts.start) window.open(data.url, '_blank', 'noopener,noreferrer');
    pollMessages();
  }

  // Back from connecting Google Calendar: reopen the Meet menu.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('meet') === '1') {
      setMeetMenu(true);
      url.searchParams.delete('meet');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }, []);

  // Chat shortcuts: "/task [domain.com] title" adds a task, "/sprints [search]" opens the sprint panel,
  // "/meet [title]" starts a Google Meet.
  async function runCommand(text) {
    const [cmd, ...rest] = text.trim().split(/\s+/);
    if (cmd === '/poll') {
      // /poll Question? | Option A | Option B
      const parts = rest.join(' ').split('|').map((x) => x.trim()).filter(Boolean);
      if (parts.length < 3) {
        setCommandError('Usage: /poll Question? | Option A | Option B');
        return true;
      }
      const res = await fetch(`/api/channels/${channel.id}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: parts[0], options: parts.slice(1) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) upsert(data);
      else setCommandError(data.error || 'Could not create the poll');
      return true;
    }
    if (cmd === '/kudos') {
      // /kudos @Full Name for something great
      const text = rest.join(' ').replace(/^@/, '');
      const people = [...(roster?.members || [])].sort((a, b) => b.name.length - a.name.length);
      const person = people.find((m) => text.toLowerCase().startsWith(m.name.toLowerCase()))
        || people.find((m) => text.toLowerCase().startsWith(m.email.split('@')[0].toLowerCase()));
      if (!person) {
        setCommandError('Usage: /kudos @Name for something great');
        return true;
      }
      const reason = text.slice(text.toLowerCase().startsWith(person.name.toLowerCase()) ? person.name.length : person.email.split('@')[0].length)
        .trim().replace(/^for\s+/i, '');
      const res = await fetch(`/api/channels/${channel.id}/kudos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: person.id, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        upsert(data);
        celebrate('kudos');
      } else setCommandError(data.error || 'Could not send kudos');
      return true;
    }
    if (cmd === '/gif') {
      inputRef.current?.openGifs(rest.join(' '));
      return true;
    }
    if (cmd === '/meet') {
      await startMeet({ title: rest.join(' ') || undefined });
      return true;
    }
    if (cmd === '/sprints' || cmd === '/sprint') {
      setSprintPanel({ open: true, query: rest.join(' ') });
      return true;
    }
    if (cmd === '/task') {
      let domain = channel.vnoc_domain || channel.tenant_domain;
      if (rest[0] && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(rest[0])) domain = rest.shift();
      const title = rest.join(' ');
      if (!title) {
        setCommandError('Usage: /task [domain.com] task title');
        return true;
      }
      const res = await fetch('/api/vnoc/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, title, channelId: channel.id }),
      });
      const data = await res.json().catch(() => ({}));
      setCommandError(res.ok ? '' : data.error || 'Could not add the task');
      if (res.ok) pollMessages();
      return true;
    }
    return false;
  }

  async function handleDelete(msg) {
    const own = msg.user_id === currentUser?.id;
    if (!window.confirm(own ? 'Delete this message?' : 'Delete this message as a moderator? This is logged.')) return;
    const res = await fetch(`/api/channels/${channel.id}/messages/${msg.id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      if (threadFor === msg.id) setThreadFor(null);
    }
    else setCommandError((await res.json().catch(() => ({}))).error || 'Could not delete the message');
  }

  async function handleSend(body, attachments) {
    if (editing) {
      const res = await fetch(`/api/channels/${channel.id}/messages/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) upsert(data);
      else setCommandError(data.error || 'Could not save the edit');
      setEditing(null);
      return;
    }
    if (!attachments?.length && body?.trim().startsWith('/') && (await runCommand(body))) return;
    const quoting = replyTo;
    setReplyTo(null);

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMessage = {
      id: tempId,
      channel_id: channel.id,
      user_id: currentUser?.id,
      body: body?.trim() || 'Shared attachment',
      type: 'text',
      created_at: new Date().toISOString(),
      author_name: currentUser?.name || '',
      author_email: currentUser?.email || '',
      author_avatar: currentUser?.avatar_url || null,
      attachments: attachments || [],
      replyTo: quoting ? { id: quoting.id, author: quoting.author_name || quoting.author_email || '', excerpt: String(quoting.body || '').slice(0, 160) } : undefined,
    };

    setMessages((prev) => mergeUniqueMessages(prev, [optimisticMessage]));

    const res = await fetch(`/api/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, attachments, replyToId: quoting?.id }),
    });

    if (res.ok) {
      const msg = await res.json();
      if (isCelebration(msg.body)) celebrate();
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return mergeUniqueMessages(withoutTemp, [msg]);
      });
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setCommandError((await res.json().catch(() => ({}))).error || 'Message not sent');
    }
  }

  function openAgentMeetingTab() {
    const params = new URLSearchParams({
      tenant: tenantSlug,
      channelId: String(channel.id),
      channelName: channel.name,
    });
    const url = `/room/new?${params.toString()}`;
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      // Popup blocked fallback: still navigate user to setup page.
      window.location.href = url;
    }
  }

  return (
    <div
      className="relative flex-1 flex flex-col h-full min-h-0"
      onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={(e) => {
        if (!e.dataTransfer?.files?.length) return;
        e.preventDefault();
        setDragging(false);
        inputRef.current?.addFiles(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 rounded-2xl border-2 border-dashed border-[#00b894] bg-gray-950/80 flex items-center justify-center text-sm text-gray-200">
          Drop files to upload to #{channel.name}
        </div>
      )}
      <header className="px-3 md:px-5 py-3 border-b border-gray-800 flex items-center justify-between gap-2 bg-gray-950/80 backdrop-blur">
        <button
          onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))}
          className="md:hidden p-1.5 -ml-1 rounded text-gray-400 hover:text-white"
          aria-label="Open channels"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          {dmPeer ? (
            <>
              <h1 className="font-semibold flex items-center gap-2">
                <PresenceDot status={peerPresence?.status || 'offline'} />
                <span className="truncate">{dmPeer.id === currentUser?.id ? 'Notes to self' : dmPeer.name || dmPeer.email}</span>
              </h1>
              <p className="text-xs text-gray-500 truncate">{describePresence(peerPresence) || dmPeer.email}</p>
            </>
          ) : (
            <>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-channel-settings', { detail: channel.id }))}
                className="font-semibold hover:underline text-left"
                title="Channel settings"
              >
                <span className="text-gray-500">{channel.emoji || (channel.is_private ? '🔒' : '#')}</span> {channel.name}
              </button>
              {channel.description && (
                <p className="text-xs text-gray-500 truncate">{channel.description}</p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!dmPeer && (
            <span className="hidden lg:inline rounded-full bg-[#00b894]/15 px-2 py-0.5 text-[10px] font-medium uppercase text-[#00b894]">
              Brand Agent Online
            </span>
          )}
          {!dmPeer && <span className="hidden sm:inline text-xs text-gray-500">{members.length} members</span>}
          <button
            onClick={() => window.dispatchEvent(new Event('toggle-members'))}
            className="lg:hidden p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
            title="Members"
            aria-label="Show members"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0zm6 2a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => setSprintPanel({ open: true, query: '' })}
            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium"
            title="Search sprints and add tasks"
          >
            Sprints
          </button>
          <div className="relative">
            <button
              onClick={() => setMeetMenu((v) => !v)}
              className="px-3.5 py-2 bg-gradient-to-r from-[#00b894] to-[#00a783] hover:opacity-95 rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-lg shadow-[#00b894]/20"
              aria-haspopup="menu"
              aria-expanded={meetMenu}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Meet ▾
            </button>
            {meetMenu && (
              <div role="menu" className="absolute right-0 top-full mt-1 z-40 w-64 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl py-1 text-sm">
                <button role="menuitem" onClick={() => startMeet()} className="w-full text-left px-3 py-2 hover:bg-gray-800">
                  <span className="block text-gray-100">Start Google Meet now</span>
                  <span className="block text-[11px] text-gray-500">Opens Meet and posts the link here</span>
                </button>
                <button role="menuitem" onClick={() => { setMeetMenu(false); setScheduling(true); }} className="w-full text-left px-3 py-2 hover:bg-gray-800">
                  <span className="block text-gray-100">Schedule Google Meet…</span>
                  <span className="block text-[11px] text-gray-500">Adds it to Google Calendar and can invite everyone</span>
                </button>
                {!dmPeer && (
                  <button role="menuitem" onClick={() => { setMeetMenu(false); openAgentMeetingTab(); }} className="w-full text-left px-3 py-2 hover:bg-gray-800 border-t border-gray-800">
                    <span className="block text-gray-100">Agent meeting</span>
                    <span className="block text-[11px] text-gray-500">In-app video call with the Brand Agent</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {focusId && (
        <div className="flex items-center justify-center gap-3 px-4 py-1.5 bg-[#8b93ff]/10 border-b border-[#8b93ff]/20 text-xs text-gray-300">
          Viewing an earlier message
          <a href={`/${tenantSlug}/c/${channel.id}`} className="px-2 py-0.5 rounded bg-[#8b93ff]/20 text-white hover:bg-[#8b93ff]/30">Jump to latest ↓</a>
        </div>
      )}
      <MessageList
        focusId={focusId}
        messages={messages}
        currentUser={currentUser}
        hasEarlier={hasEarlier}
        loadingEarlier={loadingEarlier}
        onLoadEarlier={loadEarlier}
        canModerate={canModerate}
        actions={{ onReact: handleReact, onReply: handleReply, onThread: (m) => setThreadFor(m.id), onEdit: handleEdit, onDelete: handleDelete, onVote: handleVote }}
      />
      <p className="px-5 h-4 text-[11px] text-gray-500 flex items-center gap-1.5" aria-live="polite">
        {typing.length > 0 && (
          <span className="inline-flex gap-0.5 text-gray-400" aria-hidden="true">
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </span>
        )}
        {typing.length === 1 && `${typing[0]} is typing`}
        {typing.length === 2 && `${typing[0]} and ${typing[1]} are typing`}
        {typing.length > 2 && 'Several people are typing'}
      </p>
      {commandError && (
        <p className="px-5 pb-1 text-xs text-red-400">{commandError}</p>
      )}
      <MessageInput
        ref={inputRef}
        onSend={handleSend}
        channelId={channel.id}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        placeholder={dmPeer ? `Message ${dmPeer.name || dmPeer.email}` : `Message #${channel.name}`}
      />
      {scheduling && <ScheduleMeetDialog onClose={() => setScheduling(false)} onSchedule={(opts) => { setScheduling(false); startMeet(opts); }} defaultTitle={dmPeer ? '' : `#${channel.name} meeting`} />}
      {threadFor && (
        <ThreadPanel
          channelId={channel.id}
          parentId={threadFor}
          currentUser={currentUser}
          canModerate={canModerate}
          onClose={() => { setThreadFor(null); pollMessages(); }}
        />
      )}
      <SprintPanel
        open={sprintPanel.open}
        initialQuery={sprintPanel.query}
        onClose={() => setSprintPanel({ open: false, query: '' })}
        defaultDomain={channel.vnoc_domain || channel.tenant_domain}
        channelId={channel.id}
      />
    </div>
  );
}

function ScheduleMeetDialog({ onClose, onSchedule, defaultTitle }) {
  const pad = (n) => String(n).padStart(2, '0');
  const soon = new Date(Date.now() + 60 * 60000);
  soon.setMinutes(0, 0, 0);
  const local = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`;
  const [title, setTitle] = useState(defaultTitle);
  const [when, setWhen] = useState(local);
  const [duration, setDuration] = useState(30);
  const [invite, setInvite] = useState(true);
  const input = 'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-base sm:text-sm focus:outline-none focus:border-[#1a73e8]';
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-gray-900 border border-gray-800 p-5 space-y-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
        <h2 className="font-semibold">Schedule Google Meet</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={input} />
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={input} />
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={input}>
          {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} className="w-4 h-4 accent-[#1a73e8]" />
          Send Google Calendar invites to everyone here
        </label>
        <div className="flex gap-2 pt-1">
          <button onClick={() => onSchedule({ title, start: new Date(when).toISOString(), durationMinutes: duration, invite })} disabled={!when} className="flex-1 py-2 rounded-lg bg-[#1a73e8] hover:bg-[#1765cc] text-sm font-medium text-white disabled:opacity-40">Schedule</button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-800 text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}
