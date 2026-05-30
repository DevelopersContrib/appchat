'use client';

import { useEffect, useRef } from 'react';
import LinkPreview from './LinkPreview.jsx';

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function Avatar({ name, url }) {
  if (url) return <img src={url} alt="" className="w-9 h-9 rounded-full" />;
  const initial = (name || '?')[0].toUpperCase();
  const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-orange-600', 'bg-pink-600'];
  const color = colors[initial.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-xs font-bold`}>
      {initial}
    </div>
  );
}

export default function MessageList({ messages, currentUser }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  let lastDate = null;

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5">
      {messages.map((msg, i) => {
        const msgDate = formatDate(msg.created_at);
        const showDate = msgDate !== lastDate;
        lastDate = msgDate;

        const prevMsg = messages[i - 1];
        const sameAuthor = prevMsg && prevMsg.user_id === msg.user_id && !showDate;
        const timeDiff = prevMsg
          ? new Date(msg.created_at) - new Date(prevMsg.created_at)
          : Infinity;
        const compact = sameAuthor && timeDiff < 300000;

        if (msg.type === 'system') {
          return (
            <div key={msg.id}>
              {showDate && <DateDivider date={msgDate} />}
              <div className="text-xs text-gray-500 text-center py-2">{msg.body}</div>
            </div>
          );
        }

        return (
          <div key={msg.id}>
            {showDate && <DateDivider date={msgDate} />}
            <div className={`group flex gap-3 hover:bg-gray-800/50 rounded px-2 ${compact ? 'py-0.5' : 'py-2 mt-2'}`}>
              {compact ? (
                <div className="w-9 flex-shrink-0">
                  <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              ) : (
                <Avatar name={msg.author_name || msg.author_email} url={msg.author_avatar} />
              )}
              <div className="min-w-0 flex-1">
                {!compact && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">
                      {msg.author_name || msg.author_email || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-500">{formatTime(msg.created_at)}</span>
                  </div>
                )}
                <p className="text-sm text-gray-300 break-words whitespace-pre-wrap">{msg.body}</p>
                {msg.attachments?.map((att) => (
                  <LinkPreview key={att.id} attachment={att} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

function DateDivider({ date }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 border-t border-gray-800" />
      <span className="text-xs text-gray-500 font-medium">{date}</span>
      <div className="flex-1 border-t border-gray-800" />
    </div>
  );
}
