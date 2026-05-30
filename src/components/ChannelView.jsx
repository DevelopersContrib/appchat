'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';

export default function ChannelView({ channel, initialMessages, members, currentUser, tenantSlug }) {
  const [messages, setMessages] = useState(initialMessages);
  const [calling, setCalling] = useState(false);
  const pollRef = useRef(null);

  const pollMessages = useCallback(async () => {
    const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;
    try {
      const res = await fetch(`/api/channels/${channel.id}/messages?after=${lastId}`);
      if (!res.ok) return;
      const newMsgs = await res.json();
      if (newMsgs.length > 0) {
        setMessages(prev => [...prev, ...newMsgs]);
      }
    } catch {}
  }, [channel.id, messages]);

  useEffect(() => {
    pollRef.current = setInterval(pollMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [pollMessages]);

  async function handleSend(body) {
    const res = await fetch(`/api/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });

    if (res.ok) {
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
    }
  }

  async function startCall() {
    setCalling(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant: tenantSlug,
          channelId: channel.id,
          name: `Call in #${channel.name}`,
        }),
      });

      if (res.ok) {
        const { livekitRoom } = await res.json();
        window.open(`/room/${livekitRoom}`, '_blank', 'width=1000,height=700');
      }
    } finally {
      setCalling(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <header className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="font-semibold">
            <span className="text-gray-500">#</span> {channel.name}
          </h1>
          {channel.description && (
            <p className="text-xs text-gray-500">{channel.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{members.length} members</span>
          <button
            onClick={startCall}
            disabled={calling}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {calling ? 'Starting...' : 'Call'}
          </button>
        </div>
      </header>

      <MessageList messages={messages} currentUser={currentUser} />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
