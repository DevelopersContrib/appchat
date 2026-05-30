'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';

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
  const messagesRef = useRef(messages);

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

  async function handleSend(body, attachments) {
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
    <div className="flex-1 flex flex-col h-full">
      <header className="px-5 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-950/80 backdrop-blur">
        <div>
          <h1 className="font-semibold">
            <span className="text-gray-500">#</span> {channel.name}
          </h1>
          {channel.description && (
            <p className="text-xs text-gray-500">{channel.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[#00b894]/15 px-2 py-0.5 text-[10px] font-medium uppercase text-[#00b894]">
            Brand Agent Online
          </span>
          <span className="text-xs text-gray-500">{members.length} members</span>
          <button
            onClick={openAgentMeetingTab}
            className="px-3.5 py-2 bg-gradient-to-r from-[#00b894] to-[#00a783] hover:opacity-95 rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-lg shadow-[#00b894]/20"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Start Agent Meeting
          </button>
        </div>
      </header>

      <MessageList messages={messages} currentUser={currentUser} />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
