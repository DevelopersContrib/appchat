'use client';

import { useState, useRef } from 'react';
import DrivePicker from './DrivePicker.jsx';

export default function MessageInput({ onSend }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showDrive, setShowDrive] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const inputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if ((!body.trim() && !pendingAttachments.length) || sending) return;

    setSending(true);
    await onSend(body, pendingAttachments.length ? pendingAttachments : undefined);
    setBody('');
    setPendingAttachments([]);
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleDriveSelect(file) {
    setPendingAttachments(prev => [...prev, file]);
    setShowDrive(false);
    if (!body.trim()) {
      setBody(`Shared: ${file.title}`);
    }
    inputRef.current?.focus();
  }

  function removeAttachment(i) {
    setPendingAttachments(prev => prev.filter((_, idx) => idx !== i));
  }

  return (
    <>
      {showDrive && <DrivePicker onSelect={handleDriveSelect} onClose={() => setShowDrive(false)} />}

      <form onSubmit={handleSubmit} className="px-5 py-3 border-t border-gray-800">
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingAttachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-xs">
                <span>{att.type === 'gdrive' ? '📄' : '🔗'}</span>
                <span className="truncate max-w-[150px]">{att.title}</span>
                <button type="button" onClick={() => removeAttachment(i)} className="text-gray-500 hover:text-red-400">×</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 bg-gray-800 rounded-xl px-4 py-2">
          <button
            type="button"
            onClick={() => setShowDrive(true)}
            className="text-gray-500 hover:text-[#fdcb6e] transition p-1"
            title="Attach from Google Drive"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or paste a URL..."
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm focus:outline-none placeholder:text-gray-500 max-h-32"
            style={{ minHeight: '24px' }}
          />
          <button
            type="submit"
            disabled={(!body.trim() && !pendingAttachments.length) || sending}
            className="text-[#d63031] hover:text-[#ff7675] disabled:text-gray-600 transition p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </>
  );
}
