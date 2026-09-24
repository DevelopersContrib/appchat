'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';

const THREAD_POLL_MS = 3000;

// Slack-style thread: the parent message and its replies, in a side panel (full screen on phones).
export default function ThreadPanel({ channelId, parentId, currentUser, canModerate, onClose }) {
  const [messages, setMessages] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  // The parent re-renders on every sync; a ref keeps our timers from restarting each time.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const load = useCallback(async () => {
    const res = await fetch(`/api/channels/${channelId}/messages?thread=${parentId}`);
    if (res.ok) setMessages(await res.json());
    else setError('Could not load this thread');
  }, [channelId, parentId]);

  useEffect(() => {
    load();
    const t = setInterval(load, THREAD_POLL_MS);
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [load]);

  const replace = (msg) => setMessages((prev) => prev?.map((m) => (m.id === msg.id ? msg : m)) || prev);

  async function send(body, attachments) {
    setError('');
    if (editing) {
      const res = await fetch(`/api/channels/${channelId}/messages/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) replace(data);
      else setError(data.error || 'Could not save the edit');
      setEditing(null);
      return;
    }
    const res = await fetch(`/api/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, attachments, threadId: parentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setMessages((prev) => [...(prev || []), data]);
    else setError(data.error || 'Reply not sent');
  }

  const actions = {
    onReact: async (msg, emoji) => {
      const res = await fetch(`/api/channels/${channelId}/messages/${msg.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) replace(await res.json());
    },
    onEdit: (msg) => setEditing(msg),
    onDelete: async (msg) => {
      if (!window.confirm('Delete this message?')) return;
      const res = await fetch(`/api/channels/${channelId}/messages/${msg.id}`, { method: 'DELETE' });
      if (!res.ok) return setError('Could not delete the message');
      if (msg.id === parentId) onClose();
      else setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    },
  };

  const replies = messages ? messages.length - 1 : 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] flex flex-col bg-gray-950 border-l border-gray-800 shadow-2xl"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Thread"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div>
            <h2 className="font-semibold text-sm">Thread</h2>
            <p className="text-[11px] text-gray-500">{messages ? `${replies} ${replies === 1 ? 'reply' : 'replies'}` : 'Loading…'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none px-2" aria-label="Close thread">×</button>
        </header>
        {messages ? (
          <MessageList messages={messages} currentUser={currentUser} canModerate={canModerate} actions={actions} inThread />
        ) : (
          <div className="flex-1" />
        )}
        {error && <p className="px-4 pb-1 text-xs text-red-400">{error}</p>}
        <MessageInput
          onSend={send}
          channelId={channelId}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          placeholder="Reply in thread…"
          compact
        />
      </aside>
    </>
  );
}
