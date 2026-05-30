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

function parseMetadata(metadata) {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
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
        const renderKey = `${String(msg.id ?? 'msg')}-${msg.created_at ?? 'time'}-${i}`;
        const msgDate = formatDate(msg.created_at);
        const showDate = msgDate !== lastDate;
        lastDate = msgDate;

        const prevMsg = messages[i - 1];
        const sameAuthor = prevMsg && prevMsg.user_id === msg.user_id && !showDate;
        const timeDiff = prevMsg
          ? new Date(msg.created_at) - new Date(prevMsg.created_at)
          : Infinity;
        const isCurrentUser = msg.user_id === currentUser?.id;
        const resolvedName = isCurrentUser
          ? (currentUser?.name || msg.author_name || currentUser?.email || msg.author_email)
          : (msg.author_name || msg.author_email);
        const resolvedAvatar = isCurrentUser
          ? (currentUser?.avatar_url || msg.author_avatar)
          : msg.author_avatar;
        // Keep sender identity visible for your own new messages.
        const compact = !isCurrentUser && sameAuthor && timeDiff < 300000;

        if (msg.type === 'system') {
          return (
            <div key={renderKey}>
              {showDate && <DateDivider date={msgDate} />}
              <div className="text-xs text-gray-500 text-center py-2">{msg.body}</div>
            </div>
          );
        }

        if (msg.type === 'ai') {
          const meta = parseMetadata(msg.metadata);
          const brandDomain = meta.brandDomain;
          const brandLogo = meta.brandLogo;
          const faviconUrl = brandDomain ? `https://www.brandidentity.com/favicon/${brandDomain}` : null;
          const avatarSrc = brandLogo || faviconUrl;
          return (
            <div key={renderKey}>
              {showDate && <DateDivider date={msgDate} />}
              <div className="rounded-xl border border-[#fdcb6e]/20 bg-gradient-to-r from-[#fdcb6e]/10 to-transparent px-3 py-2.5 my-2">
                <div className="flex items-center gap-2 mb-1">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Brand" className="w-6 h-6 rounded-full bg-gray-900 border border-[#fdcb6e]/20 object-contain p-0.5" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#fdcb6e] text-gray-950 text-[10px] font-bold flex items-center justify-center">
                      AI
                    </div>
                  )}
                  <span className="text-xs font-semibold text-[#fdcb6e]">Brand Agent</span>
                  <span className="text-[10px] text-gray-500">{formatTime(msg.created_at)}</span>
                </div>
                <p className="text-sm text-gray-200 break-words whitespace-pre-wrap">{msg.body}</p>
              </div>
            </div>
          );
        }

        return (
          <div key={renderKey}>
            {showDate && <DateDivider date={msgDate} />}
            <div className={`group flex gap-3 hover:bg-gray-800/50 rounded px-2 ${compact ? 'py-0.5' : 'py-2 mt-2'}`}>
              {compact ? (
                <div className="w-9 flex-shrink-0">
                  <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              ) : (
                <Avatar name={resolvedName} url={resolvedAvatar} />
              )}
              <div className="min-w-0 flex-1">
                {!compact && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">
                      {resolvedName || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-500">{formatTime(msg.created_at)}</span>
                  </div>
                )}
                <p className="text-sm text-gray-300 break-words whitespace-pre-wrap">{msg.body}</p>
                {msg.attachments?.map((att, attIndex) => (
                  <LinkPreview
                    key={`${String(att.id ?? 'att')}-${att.url ?? ''}-${attIndex}`}
                    attachment={att}
                  />
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
