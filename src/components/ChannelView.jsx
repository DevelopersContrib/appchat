'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';
import SprintPanel from './SprintPanel.jsx';

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

export default function ChannelView({ channel, initialMessages, members, currentUser, tenantSlug }) {
  const [messages, setMessages] = useState(() => mergeUniqueMessages([], initialMessages || []));
  const pollRef = useRef(null);
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [sprintPanel, setSprintPanel] = useState({ open: false, query: '' });
  const [commandError, setCommandError] = useState('');
  const messagesRef = useRef(messages);
  const [hasEarlier, setHasEarlier] = useState((initialMessages || []).length >= 100);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

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

  const pollMessages = useCallback(async () => {
    const current = messagesRef.current || [];
    const lastId = current.reduce((max, msg) => Math.max(max, Number(msg.id) || 0), 0);
    try {
      const res = await fetch(`/api/channels/${channel.id}/messages?after=${lastId}`);
      if (!res.ok) return;
      const newMsgs = await res.json();
      if (newMsgs.length > 0) {
        setMessages(prev => mergeUniqueMessages(prev, newMsgs));
      }
    } catch {}
  }, [channel.id]);

  useEffect(() => {
    pollMessages();
    pollRef.current = setInterval(pollMessages, 1200);
    return () => clearInterval(pollRef.current);
  }, [pollMessages]);

  useEffect(() => {
    fetch(`/api/channels/${channel.id}/agent`, { method: 'POST' }).catch(() => {});
  }, [channel.id]);

  // Chat shortcuts: "/task [domain.com] title" adds a task, "/sprints [search]" opens the sprint panel.
  async function runCommand(text) {
    const [cmd, ...rest] = text.trim().split(/\s+/);
    if (cmd === '/sprints' || cmd === '/sprint') {
      setSprintPanel({ open: true, query: rest.join(' ') });
      return true;
    }
    if (cmd === '/task') {
      let domain = channel.tenant_domain;
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

  async function handleSend(body, attachments) {
    if (!attachments?.length && body?.trim().startsWith('/') && (await runCommand(body))) return;

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
    };

    setMessages((prev) => mergeUniqueMessages(prev, [optimisticMessage]));

    const res = await fetch(`/api/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, attachments }),
    });

    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return mergeUniqueMessages(withoutTemp, [msg]);
      });
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
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
          <h1 className="font-semibold">
            <span className="text-gray-500">#</span> {channel.name}
          </h1>
          {channel.description && (
            <p className="text-xs text-gray-500 truncate">{channel.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden lg:inline rounded-full bg-[#00b894]/15 px-2 py-0.5 text-[10px] font-medium uppercase text-[#00b894]">
            Brand Agent Online
          </span>
          <span className="hidden sm:inline text-xs text-gray-500">{members.length} members</span>
          <button
            onClick={() => setSprintPanel({ open: true, query: '' })}
            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium"
            title="Search sprints and add tasks"
          >
            Sprints
          </button>
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
        </div>
      </header>

      <MessageList
        messages={messages}
        currentUser={currentUser}
        hasEarlier={hasEarlier}
        loadingEarlier={loadingEarlier}
        onLoadEarlier={loadEarlier}
      />
      {commandError && (
        <p className="px-5 pb-1 text-xs text-red-400">{commandError}</p>
      )}
      <MessageInput ref={inputRef} onSend={handleSend} channelId={channel.id} />
      <SprintPanel
        open={sprintPanel.open}
        initialQuery={sprintPanel.query}
        onClose={() => setSprintPanel({ open: false, query: '' })}
        defaultDomain={channel.tenant_domain}
        channelId={channel.id}
      />
    </div>
  );
}
