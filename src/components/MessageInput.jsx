'use client';

import { useState, useRef } from 'react';

export default function MessageInput({ onSend }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!body.trim() || sending) return;

    setSending(true);
    await onSend(body);
    setBody('');
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 py-3 border-t border-gray-800">
      <div className="flex items-end gap-2 bg-gray-800 rounded-xl px-4 py-2">
        <textarea
          ref={inputRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 bg-transparent resize-none text-sm focus:outline-none placeholder:text-gray-500 max-h-32"
          style={{ minHeight: '24px' }}
        />
        <button
          type="submit"
          disabled={!body.trim() || sending}
          className="text-blue-500 hover:text-blue-400 disabled:text-gray-600 transition p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </form>
  );
}
