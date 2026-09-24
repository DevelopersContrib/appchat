'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import LinkPreview from './LinkPreview.jsx';
import { isEmojiOnly } from '@/lib/emoji-data.js';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '✅'];
export const MORE_REACTIONS = ['🔥', '🙏', '💯', '😮', '😢', '😡', '🚀', '👏', '🤔', '💡', '⚡', '🙌', '😍', '😅', '👌', '❌', '⭐', '☕'];

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
  if (url) return <img src={url} alt="" className="w-9 h-9 rounded-full object-cover" />;
  const initial = (name || '?')[0].toUpperCase();
  const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-orange-600', 'bg-pink-600'];
  const color = colors[initial.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-xs font-bold`}>
      {initial}
    </div>
  );
}

export function parseMetadata(metadata) {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

// Bold any "@word" so mentions stand out; the viewer's own mentions are highlighted.
// Messages that are just 1–3 emoji are shown big.
function MessageBody({ text, myNames }) {
  if (isEmojiOnly(text)) return <p className="text-4xl leading-tight py-0.5 bounce-in">{text}</p>;
  const parts = String(text).split(/(@[\p{L}\p{N}_.-]+)/u);
  return (
    <p className="text-sm text-gray-300 break-words whitespace-pre-wrap">
      {parts.map((p, i) => {
        if (!p.startsWith('@') || p.length < 2) return p;
        const mine = myNames.some((n) => p.slice(1).toLowerCase() === n);
        return (
          <span key={i} className={`font-semibold rounded px-0.5 ${mine ? 'bg-[#fdcb6e]/20 text-[#fdcb6e]' : 'text-[#8b93ff]'}`}>{p}</span>
        );
      })}
    </p>
  );
}

/**
 * actions: { onReact(msg, emoji), onReply(msg), onThread(msg), onEdit(msg), onDelete(msg) } — each optional.
 * inThread: rendering inside the thread panel (no thread buttons/counts, no auto-load-earlier).
 */
export default function MessageList({ messages, currentUser, hasEarlier, loadingEarlier, onLoadEarlier, canModerate, actions = {}, inThread = false, focusId = null }) {
  const endRef = useRef(null);
  const newestId = messages[messages.length - 1]?.id;
  const metas = useMemo(() => messages.map((m) => parseMetadata(m.metadata)), [messages]);
  const [pickerFor, setPickerFor] = useState(null);
  const [sheetFor, setSheetFor] = useState(null);
  const pressTimer = useRef(null);
  // Messages present on first render don't animate in; later ones slide in.
  const initialIds = useRef(null);
  if (initialIds.current === null) initialIds.current = new Set(messages.map((m) => m.id));
  const myNames = useMemo(() => {
    const n = [currentUser?.name, currentUser?.name?.split(' ')[0], currentUser?.email?.split('@')[0], 'channel', 'here', 'everyone'];
    return n.filter(Boolean).map((x) => x.toLowerCase());
  }, [currentUser]);

  // Follow new messages at the bottom, but stay put when older history is loaded above.
  // When opened on a specific message (from search), scroll to it instead.
  useEffect(() => {
    if (focusId) {
      document.getElementById(`msg-${focusId}`)?.scrollIntoView({ block: 'center' });
      return;
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [newestId, focusId]);

  useEffect(() => {
    if (!pickerFor) return;
    const close = () => setPickerFor(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [pickerFor]);

  const canAct = (msg) => !String(msg.id).startsWith('temp-') && msg.type !== 'system' && !msg.deleted;
  const isMine = (msg) => msg.user_id === currentUser?.id;

  function ActionBar({ msg }) {
    const mine = isMine(msg);
    return (
      <div className="absolute right-2 -top-3 z-10 hidden md:group-hover:flex items-center gap-0.5 rounded-lg border border-gray-700 bg-gray-900 px-1 py-0.5 shadow-lg">
        {actions.onReact && QUICK_REACTIONS.slice(0, 4).map((e) => (
          <button key={e} onClick={() => actions.onReact(msg, e)} className="px-1 text-base hover:scale-125 transition" title={`React ${e}`}>{e}</button>
        ))}
        {actions.onReact && (
          <button onClick={(ev) => { ev.stopPropagation(); setPickerFor(msg.id); }} className="px-1.5 text-sm text-gray-400 hover:text-white" title="More reactions">＋</button>
        )}
        {actions.onReply && <IconButton label="Reply" onClick={() => actions.onReply(msg)}>↩</IconButton>}
        {!inThread && actions.onThread && <IconButton label="Reply in thread" onClick={() => actions.onThread(msg)}>🧵</IconButton>}
        {mine && actions.onEdit && msg.type === 'text' && <IconButton label="Edit" onClick={() => actions.onEdit(msg)}>✎</IconButton>}
        {(mine || canModerate) && actions.onDelete && <IconButton label={mine ? 'Delete' : 'Delete as moderator'} danger onClick={() => actions.onDelete(msg)}>🗑</IconButton>}
      </div>
    );
  }

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
        const renderKey = `${String(msg.id ?? 'msg')}-${i}`;
        const msgDate = formatDate(msg.created_at);
        const showDate = msgDate !== lastDate;
        lastDate = msgDate;

        const prevMsg = messages[i - 1];
        const meta = metas[i];
        // Imported (e.g. Discord) messages have no user_id; group them by their original author instead.
        const importedAuthor = !msg.user_id ? meta.author : null;
        const sameAuthor = prevMsg && prevMsg.type !== 'system' && authorKey(prevMsg, metas[i - 1]) === authorKey(msg, meta) && !showDate;
        const timeDiff = prevMsg ? new Date(msg.created_at) - new Date(prevMsg.created_at) : Infinity;
        const isCurrentUser = isMine(msg);
        const resolvedName = isCurrentUser
          ? (currentUser?.name || msg.author_name || currentUser?.email || msg.author_email)
          : (msg.author_name || msg.author_email || importedAuthor?.name);
        const resolvedAvatar = isCurrentUser
          ? (currentUser?.avatar_url || msg.author_avatar)
          : (msg.author_avatar || importedAuthor?.avatar);
        const replyTo = msg.replyTo || meta.replyTo;
        const compact = !isCurrentUser && sameAuthor && timeDiff < 300000 && !replyTo;
        const mentionsMe = !isCurrentUser && (meta.mentionsEveryone || (meta.mentions || []).includes(currentUser?.id));

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
          const avatarSrc = meta.brandLogo || (brandDomain ? `https://www.brandidentity.com/favicon/${brandDomain}` : null);
          return (
            <div key={renderKey}>
              {showDate && <DateDivider date={msgDate} />}
              <div className="rounded-xl border border-[#fdcb6e]/20 bg-gradient-to-r from-[#fdcb6e]/10 to-transparent px-3 py-2.5 my-2">
                <div className="flex items-center gap-2 mb-1">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Brand" className="w-6 h-6 rounded-full bg-gray-900 border border-[#fdcb6e]/20 object-contain p-0.5" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#fdcb6e] text-gray-950 text-[10px] font-bold flex items-center justify-center">AI</div>
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
            <div
              id={`msg-${msg.id}`}
              className={`group relative flex gap-3 rounded px-2 ${initialIds.current.has(msg.id) ? '' : 'msg-in'} ${compact ? 'py-0.5' : 'py-2 mt-2'} ${msg.id === focusId ? 'bg-[#8b93ff]/15 ring-1 ring-[#8b93ff]/50' : mentionsMe ? 'bg-[#fdcb6e]/5 border-l-2 border-[#fdcb6e]/60' : 'hover:bg-gray-800/50'}`}
              onTouchStart={() => { if (canAct(msg)) pressTimer.current = setTimeout(() => setSheetFor(msg), 450); }}
              onTouchEnd={() => clearTimeout(pressTimer.current)}
              onTouchMove={() => clearTimeout(pressTimer.current)}
            >
              {canAct(msg) && <ActionBar msg={msg} />}
              {pickerFor === msg.id && (
                <EmojiPicker onPick={(e) => { actions.onReact(msg, e); setPickerFor(null); }} className="absolute right-2 top-6 z-20" />
              )}
              {compact ? (
                <div className="w-9 flex-shrink-0">
                  <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100">{formatTime(msg.created_at)}</span>
                </div>
              ) : (
                <Avatar name={resolvedName} url={resolvedAvatar} />
              )}
              <div className="min-w-0 flex-1">
                {!compact && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">{resolvedName || 'Unknown'}</span>
                    {meta.source === 'discord' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300">Discord</span>}
                    {meta.source === 'slack' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#4A154B]/40 text-pink-200">Slack</span>}
                    {meta.via && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6c5ce7]/20 text-[#a29bfe]" title="Posted through an AI assistant">✨ via {meta.via}</span>}
                    <span className="text-xs text-gray-500">{formatTime(msg.created_at)}</span>
                  </div>
                )}
                {replyTo && (
                  <p className="text-xs text-gray-500 truncate border-l-2 border-gray-600 pl-2 my-0.5">
                    ↪ <span className="text-gray-300">{replyTo.author}</span> {replyTo.excerpt}
                  </p>
                )}
                {meta.card?.kind === 'poll' ? <PollCard card={meta.card} poll={msg.poll} onVote={(i) => actions.onVote?.(msg, i)} />
                  : meta.card?.kind === 'kudos' ? <KudosCard card={meta.card} />
                  : meta.card?.kind === 'debrief' ? <DebriefCard card={meta.card} /> : meta.card?.kind === 'meet' ? <MeetCard card={meta.card} /> : meta.card ? <VnocCard card={meta.card} /> : !(msg.body === 'Shared attachment' && msg.attachments?.length) && (
                  <MessageBody text={msg.body} myNames={myNames} />
                )}
                {msg.edited_at && <span className="text-[10px] text-gray-600">(edited)</span>}
                {msg.attachments?.map((att, attIndex) => (
                  <LinkPreview key={`${String(att.id ?? 'att')}-${att.url ?? ''}-${attIndex}`} attachment={att} />
                ))}
                {msg.reactions?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {msg.reactions.map((r) => (
                      <button
                        key={`${r.emoji}-${r.count}`}
                        onClick={() => actions.onReact?.(msg, r.emoji)}
                        title={r.names?.join(', ')}
                        className={`reaction-pop flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs ${r.mine ? 'border-[#00b894]/60 bg-[#00b894]/15 text-white' : 'border-gray-700 bg-gray-800/60 text-gray-300 hover:border-gray-500'}`}
                      >
                        <span>{r.emoji}</span>
                        <span>{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!inThread && msg.reply_count > 0 && (
                  <button onClick={() => actions.onThread?.(msg)} className="mt-1 text-xs font-medium text-[#8b93ff] hover:underline">
                    {msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}
                    {msg.last_reply_at && <span className="text-gray-500 font-normal"> · last {formatTime(msg.last_reply_at)}</span>}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />

      {sheetFor && (
        <MobileActionSheet
          msg={sheetFor}
          mine={isMine(sheetFor)}
          canModerate={canModerate}
          inThread={inThread}
          actions={actions}
          onClose={() => setSheetFor(null)}
        />
      )}
    </div>
  );
}

function IconButton({ label, onClick, danger, children }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={`px-1.5 text-sm ${danger ? 'text-gray-400 hover:text-red-400' : 'text-gray-400 hover:text-white'}`}>
      {children}
    </button>
  );
}

export function EmojiPicker({ onPick, className = '' }) {
  return (
    <div onClick={(e) => e.stopPropagation()} className={`grid grid-cols-8 gap-0.5 p-2 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl ${className}`}>
      {[...QUICK_REACTIONS, ...MORE_REACTIONS].map((e) => (
        <button key={e} onClick={() => onPick(e)} className="w-8 h-8 rounded hover:bg-gray-800 text-lg">{e}</button>
      ))}
    </div>
  );
}

// Press-and-hold menu on phones.
function MobileActionSheet({ msg, mine, canModerate, inThread, actions, onClose }) {
  const run = (fn) => { onClose(); fn(msg); };
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end md:hidden" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-gray-900 border-t border-gray-800 p-3 space-y-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }} onClick={(e) => e.stopPropagation()}>
        {actions.onReact && (
          <div className="flex justify-between px-1">
            {QUICK_REACTIONS.map((e) => (
              <button key={e} onClick={() => { onClose(); actions.onReact(msg, e); }} className="w-11 h-11 rounded-full bg-gray-800 text-xl">{e}</button>
            ))}
          </div>
        )}
        {actions.onReply && <SheetItem onClick={() => run(actions.onReply)}>Reply</SheetItem>}
        {!inThread && actions.onThread && <SheetItem onClick={() => run(actions.onThread)}>Reply in thread</SheetItem>}
        {mine && actions.onEdit && msg.type === 'text' && <SheetItem onClick={() => run(actions.onEdit)}>Edit message</SheetItem>}
        {msg.body && <SheetItem onClick={() => { onClose(); navigator.clipboard?.writeText(msg.body); }}>Copy text</SheetItem>}
        {(mine || canModerate) && actions.onDelete && <SheetItem danger onClick={() => run(actions.onDelete)}>Delete message</SheetItem>}
      </div>
    </div>
  );
}

function SheetItem({ children, onClick, danger }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-3 rounded-xl bg-gray-800/60 text-sm ${danger ? 'text-red-400' : 'text-gray-100'}`}>
      {children}
    </button>
  );
}

function PollCard({ card, poll, onVote }) {
  const counts = poll?.counts || card.options.map(() => 0);
  const total = poll?.total || 0;
  return (
    <div className="mt-1 max-w-md rounded-xl border border-gray-700 bg-gray-900/70 p-3">
      <p className="text-[10px] uppercase tracking-wide text-[#fdcb6e]">📊 Poll</p>
      <p className="text-sm font-semibold text-gray-100 mb-2">{card.question}</p>
      <div className="space-y-1.5">
        {card.options.map((opt, i) => {
          const pct = total ? Math.round((counts[i] / total) * 100) : 0;
          const mine = poll?.myVote === i;
          return (
            <button
              key={i}
              onClick={() => onVote(i)}
              className={`relative w-full overflow-hidden rounded-lg border text-left text-sm px-3 py-2 transition ${mine ? 'border-[#00b894]' : 'border-gray-700 hover:border-gray-500'}`}
            >
              <span className={`absolute inset-y-0 left-0 transition-all duration-500 ${mine ? 'bg-[#00b894]/25' : 'bg-gray-700/40'}`} style={{ width: `${pct}%` }} />
              <span className="relative flex items-center gap-2">
                <span className="text-gray-100">{mine ? '✓ ' : ''}{opt}</span>
                <span className="ml-auto text-xs text-gray-400">{counts[i]} · {pct}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-gray-500">{total} {total === 1 ? 'vote' : 'votes'} · tap again to remove your vote</p>
    </div>
  );
}

function KudosCard({ card }) {
  return (
    <div className="mt-1 max-w-md rounded-xl border border-[#fdcb6e]/40 bg-gradient-to-r from-[#fdcb6e]/15 via-[#d63031]/10 to-[#6c5ce7]/15 px-4 py-3 bounce-in">
      <p className="text-2xl">🙌</p>
      <p className="text-sm font-semibold text-gray-100">Kudos to {card.toName}!</p>
      {card.reason && <p className="text-sm text-gray-300">for {card.reason}</p>}
    </div>
  );
}

function DebriefCard({ card }) {
  return (
    <div className="mt-1 max-w-lg rounded-xl border border-[#6c5ce7]/40 bg-[#6c5ce7]/10 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[#a29bfe]">LoopAgent daily debrief · {card.date}</p>
      <p className="text-sm font-semibold text-gray-100">{card.headline}</p>
      {card.summary && <p className="mt-1 text-sm text-gray-300 whitespace-pre-wrap line-clamp-6">{card.summary}</p>}
      <a href={card.url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-[#6c5ce7] hover:bg-[#5b4bd6] text-xs font-medium text-white">
        Read full debrief
      </a>
    </div>
  );
}

function MeetCard({ card }) {
  const when = card.start ? new Date(card.start) : null;
  return (
    <div className="mt-1 max-w-md rounded-xl border border-[#1a73e8]/40 bg-[#1a73e8]/10 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[#8ab4f8]">Google Meet · {card.scheduled && when ? when.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'now'}</p>
      <p className="text-sm font-medium text-gray-100">{card.title}</p>
      {card.invited > 0 && <p className="text-xs text-gray-400">Calendar invites sent to {card.invited}</p>}
      <div className="mt-2 flex gap-2">
        <a href={card.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-[#1a73e8] hover:bg-[#1765cc] text-xs font-medium text-white">Join Google Meet</a>
        {card.eventUrl && <a href={card.eventUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-gray-800 text-xs text-gray-200">Calendar</a>}
      </div>
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
