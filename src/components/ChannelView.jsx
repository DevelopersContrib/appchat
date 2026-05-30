'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';
import DailyRoom from './DailyRoom.jsx';

export default function ChannelView({ channel, initialMessages, members, currentUser, tenantSlug }) {
  const [messages, setMessages] = useState(initialMessages);
  const [calling, setCalling] = useState(false);
  const [dailyUrl, setDailyUrl] = useState(null);
  const [showCallMenu, setShowCallMenu] = useState(false);
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

  async function startLiveKitCall() {
    setCalling(true);
    setShowCallMenu(false);
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

  async function startDailyRoom() {
    setCalling(true);
    setShowCallMenu(false);
    try {
      const res = await fetch('/api/daily/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          name: channel.name,
        }),
      });

      if (res.ok) {
        const { url } = await res.json();
        setDailyUrl(url);
      }
    } finally {
      setCalling(false);
    }
  }

  if (dailyUrl) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <header className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="font-semibold">
              <span className="text-gray-500">#</span> {channel.name}
              <span className="ml-2 px-2 py-0.5 bg-green-600/20 text-green-400 text-xs rounded-full">Live</span>
            </h1>
          </div>
          <button
            onClick={() => setDailyUrl(null)}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-medium transition"
          >
            Leave Room
          </button>
        </header>
        <div className="flex-1 flex">
          <div className="flex-1 p-2">
            <DailyRoom url={dailyUrl} onLeave={() => setDailyUrl(null)} />
          </div>
          <div className="w-80 border-l border-gray-800 flex flex-col">
            <MessageList messages={messages} currentUser={currentUser} />
            <MessageInput onSend={handleSend} />
          </div>
        </div>
      </div>
    );
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

          <div className="relative">
            <button
              onClick={() => setShowCallMenu(!showCallMenu)}
              disabled={calling}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {calling ? 'Starting...' : 'Meet'}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showCallMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <button
                  onClick={startDailyRoom}
                  className="w-full px-4 py-3 text-left hover:bg-gray-800 transition"
                >
                  <p className="text-sm font-medium">Daily Room</p>
                  <p className="text-xs text-gray-500">Video chat + screen share</p>
                </button>
                <div className="border-t border-gray-800" />
                <button
                  onClick={startLiveKitCall}
                  className="w-full px-4 py-3 text-left hover:bg-gray-800 transition"
                >
                  <p className="text-sm font-medium">LiveKit Call</p>
                  <p className="text-xs text-gray-500">HD video + AI agent</p>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <MessageList messages={messages} currentUser={currentUser} />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
