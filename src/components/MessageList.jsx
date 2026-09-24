'use client';

import { useEffect, useMemo, useRef } from 'react';
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

export default function MessageList({ messages, currentUser, hasEarlier, loadingEarlier, onLoadEarlier }) {
  const endRef = useRef(null);
  const newestId = messages[messages.length - 1]?.id;
  const metas = useMemo(() => messages.map((m) => parseMetadata(m.metadata)), [messages]);

  // Follow new messages at the bottom, but stay put when older history is loaded above.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [newestId]);

  let lastDate = null;

  return (
    <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-0.5">
      {hasEarlier && (
        <div className="text-center pb-2">
          <button
            onClick={onLoadEarlier}
            disabled={loadingEarlier}
            className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-full bg-gray-800/60 disabled:opacity-50"
          >
            {loadingEarlier ? 'Loading…' : 'Load earlier messages'}
          </button>
        </div>
      )}
      {messages.map((msg, i) => {
        const renderKey = `${String(msg.id ?? 'msg')}-${msg.created_at ?? 'time'}-${i}`;
        const msgDate = formatDate(msg.created_at);
        const showDate = msgDate !== lastDate;
        lastDate = msgDate;

        const prevMsg = messages[i - 1];
        const meta = metas[i];
        // Imported (e.g. Discord) messages have no user_id; group them by their original author instead.
        const importedAuthor = !msg.user_id ? meta.author : null;
        const sameAuthor = prevMsg && authorKey(prevMsg, metas[i - 1]) === authorKey(msg, meta) && !showDate;
        const timeDiff = prevMsg
          ? new Date(msg.created_at) - new Date(prevMsg.created_at)
          : Infinity;
        const isCurrentUser = msg.user_id === currentUser?.id;
        const resolvedName = isCurrentUser
          ? (currentUser?.name || msg.author_name || currentUser?.email || msg.author_email)
          : (msg.author_name || msg.author_email || importedAuthor?.name);
        const resolvedAvatar = isCurrentUser
          ? (currentUser?.avatar_url || msg.author_avatar)
          : (msg.author_avatar || importedAuthor?.avatar);
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
                    {meta.source === 'discord' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300">Discord</span>
                    )}
                    <span className="text-xs text-gray-500">{formatTime(msg.created_at)}</span>
                  </div>
                )}
                {meta.replyTo && (
                  <p className="text-xs text-gray-500 truncate border-l-2 border-gray-700 pl-2 my-0.5">
                    ↪ <span className="text-gray-400">{meta.replyTo.author}</span> {meta.replyTo.excerpt}
                  </p>
                )}
                {meta.card ? <VnocCard card={meta.card} /> : !(msg.body === 'Shared attachment' && msg.attachments?.length) && (
                  <p className="text-sm text-gray-300 break-words whitespace-pre-wrap">{msg.body}</p>
                )}
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

// Task/sprint created from chat (see /api/vnoc/*).
function VnocCard({ card }) {
  const isTask = card.kind === 'vnoc_task';
  const Wrapper = card.url ? 'a' : 'div';
  return (
    <Wrapper
      {...(card.url ? { href: card.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="mt-1 block max-w-md rounded-xl border border-[#00b894]/30 bg-[#00b894]/5 px-3 py-2 hover:border-[#00b894]/60 transition"
    >
      <p className="text-[10px] uppercase tracking-wide text-[#00b894]">
        {isTask ? 'New task' : 'New sprint'} · {card.domain}
      </p>
      <p className="text-sm font-medium text-gray-100">{card.title}</p>
      {isTask && (
        <p className="text-xs text-gray-500">
          {card.sprintTitle ? `in ${card.sprintTitle}` : ''}{card.priority && card.priority !== 'normal' ? ` · ${card.priority}` : ''}
        </p>
      )}
    </Wrapper>
  );
}

function authorKey(msg, meta) {
  if (msg.user_id) return `u:${msg.user_id}`;
  return meta.author?.id ? `x:${meta.author.id}` : `m:${msg.id}`;
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
