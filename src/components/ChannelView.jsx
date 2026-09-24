'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';
import SprintPanel from './SprintPanel.jsx';
import ThreadPanel from './ThreadPanel.jsx';
import { useRoster, PresenceDot, describePresence } from './presence.jsx';

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

export default function ChannelView({ channel, initialMessages, members, currentUser, tenantSlug, dmPeer, canModerate }) {
  const roster = useRoster();
  const peerPresence = dmPeer ? roster?.members?.find((m) => m.id === dmPeer.id) : null;
  const [messages, setMessages] = useState(() => mergeUniqueMessages([], initialMessages || []));
  const pollRef = useRef(null);
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [sprintPanel, setSprintPanel] = useState({ open: false, query: '' });
  const [commandError, setCommandError] = useState('');
  const messagesRef = useRef(messages);
  const [hasEarlier, setHasEarlier] = useState((initialMessages || []).length >= 100);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [threadFor, setThreadFor] = useState(null);
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

  function handleEdit(msg) {
    setReplyTo(null);
    setEditing(msg);
  }

  function handleReply(msg) {
    setEditing(null);
    setReplyTo(msg);
  }

  useEffect(() => {
    pollMessages();
    pollRef.current = setInterval(pollMessages, 1200);
    return () => clearInterval(pollRef.current);
  }, [pollMessages]);

  // The Brand Agent lives in channels, not in direct messages.
  useEffect(() => {
    if (dmPeer) return;
    fetch(`/api/channels/${channel.id}/agent`, { method: 'POST' }).catch(() => {});
  }, [channel.id, dmPeer]);

  // Chat shortcuts: "/task [domain.com] title" adds a task, "/sprints [search]" opens the sprint panel.
  async function runCommand(text) {
    const [cmd, ...rest] = text.trim().split(/\s+/);
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
                <span className="text-gray-500">{channel.is_private ? '🔒' : '#'}</span> {channel.name}
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
          {!dmPeer && (
          <button
            onClick={openAgentMeetingTab}
            className="px-3.5 py-2 bg-gradient-to-r from-[#00b894] to-[#00a783] hover:opacity-95 rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-lg shadow-[#00b894]/20"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Start Agent Meeting</span>
            <span className="sm:hidden">Meet</span>
          </button>
          )}
        </div>
      </header>

      <MessageList
        messages={messages}
        currentUser={currentUser}
        hasEarlier={hasEarlier}
        loadingEarlier={loadingEarlier}
        onLoadEarlier={loadEarlier}
        canModerate={canModerate}
        actions={{ onReact: handleReact, onReply: handleReply, onThread: (m) => setThreadFor(m.id), onEdit: handleEdit, onDelete: handleDelete }}
      />
      <p className="px-5 h-4 text-[11px] text-gray-500" aria-live="polite">
        {typing.length === 1 && `${typing[0]} is typing…`}
        {typing.length === 2 && `${typing[0]} and ${typing[1]} are typing…`}
        {typing.length > 2 && 'Several people are typing…'}
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
