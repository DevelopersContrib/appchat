'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import DrivePicker from './DrivePicker.jsx';
import { useRoster } from './presence.jsx';

const TYPING_PING_MS = 3000;

function putWithProgress(url, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'));
    xhr.send(file);
  });
}

// Exposes addFiles() so the channel view can hand over dropped files.
// replyTo / editing: banners above the box; onSend(body, attachments) handles both (edit = PATCH in the parent).
const MessageInput = forwardRef(function MessageInput(
  { onSend, channelId, replyTo, onCancelReply, editing, onCancelEdit, placeholder, compact },
  ref
) {
  const [body, setBody] = useState('');
  const [mention, setMention] = useState(null); // { query, start, index }
  const lastTypingPing = useRef(0);
  const roster = useRoster();
  const [sending, setSending] = useState(false);
  const [showDrive, setShowDrive] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const uploading = pendingAttachments.some((a) => a.uploading);

  useImperativeHandle(ref, () => ({ addFiles: uploadFiles, focus: () => inputRef.current?.focus() }));

  // Editing loads the message text into the box.
  useEffect(() => {
    if (editing) {
      setBody(editing.body || '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  const mentionOptions = mention
    ? (roster?.members || [])
        .filter((m) => !mention.query || m.name.toLowerCase().includes(mention.query) || m.email.toLowerCase().startsWith(mention.query))
        .slice(0, 6)
    : [];

  function handleChange(e) {
    const value = e.target.value;
    setBody(value);
    // "@ana" right before the caret opens the mention list.
    const caret = e.target.selectionStart ?? value.length;
    const m = /(^|\s)@([\p{L}\p{N}_.-]*)$/u.exec(value.slice(0, caret));
    setMention(m ? { query: m[2].toLowerCase(), start: caret - m[2].length - 1, index: 0 } : null);
    // Let others see "typing…" (throttled).
    if (value.trim() && Date.now() - lastTypingPing.current > TYPING_PING_MS && channelId && !editing) {
      lastTypingPing.current = Date.now();
      fetch(`/api/channels/${channelId}/typing`, { method: 'POST' }).catch(() => {});
    }
  }

  function pickMention(member) {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? body.length;
    const insert = `@${member.name} `;
    const next = body.slice(0, mention.start) + insert + body.slice(caret);
    setBody(next);
    setMention(null);
    setTimeout(() => {
      el?.focus();
      const pos = mention.start + insert.length;
      el?.setSelectionRange(pos, pos);
    }, 0);
  }

  function updateAttachment(localId, patch) {
    setPendingAttachments((prev) => prev.map((a) => (a.localId === localId ? { ...a, ...patch } : a)));
  }

  function uploadFiles(fileList) {
    const files = Array.from(fileList || []).slice(0, 10);
    for (const file of files) {
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const contentType = file.type || 'application/octet-stream';
      setPendingAttachments((prev) => [...prev, {
        localId,
        type: 'file',
        title: file.name || 'pasted-image.png',
        mimeType: contentType,
        sizeBytes: file.size,
        previewUrl: contentType.startsWith('image/') ? URL.createObjectURL(file) : null,
        uploading: true,
        progress: 0,
      }]);

      (async () => {
        try {
          const res = await fetch('/api/uploads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId, filename: file.name || 'pasted-image.png', contentType, size: file.size }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Upload failed');
          await putWithProgress(data.uploadUrl, file, data.contentType, (p) => updateAttachment(localId, { progress: p }));
          updateAttachment(localId, { storageKey: data.key, uploading: false, progress: 1 });
        } catch (err) {
          updateAttachment(localId, { uploading: false, error: err.message });
        }
      })();
    }
  }

  function handlePaste(e) {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length) {
      e.preventDefault();
      uploadFiles(files);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ready = pendingAttachments
      .filter((a) => !a.error && !a.uploading && (a.type !== 'file' || a.storageKey))
      .map(({ localId, uploading, progress, previewUrl, error, ...a }) => ({ ...a, url: a.url || previewUrl }));
    if ((!body.trim() && !ready.length) || sending || uploading) return;

    setSending(true);
    setMention(null);
    await onSend(body, ready.length ? ready : undefined);
    lastTypingPing.current = 0;
    setBody('');
    setPendingAttachments([]);
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (mention && mentionOptions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setMention((m) => ({ ...m, index: (m.index + d + mentionOptions.length) % mentionOptions.length }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickMention(mentionOptions[mention.index] || mentionOptions[0]);
        return;
      }
      if (e.key === 'Escape') {
        setMention(null);
        return;
      }
    }
    if (e.key === 'Escape') {
      if (editing) { setBody(''); onCancelEdit?.(); }
      else if (replyTo) onCancelReply?.();
      return;
    }
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
    setPendingAttachments(prev => {
      if (prev[i]?.previewUrl) URL.revokeObjectURL(prev[i].previewUrl);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function addLinkAttachment() {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) return;
    setPendingAttachments(prev => [
      ...prev,
      {
        type: 'link',
        title: linkTitle.trim() || url,
        url,
      },
    ]);
    setLinkUrl('');
    setLinkTitle('');
    setShowLink(false);
    if (!body.trim()) {
      setBody('Shared link');
    }
    inputRef.current?.focus();
  }

  return (
    <>
      {showDrive && <DrivePicker onSelect={handleDriveSelect} onClose={() => setShowDrive(false)} />}

      <form onSubmit={handleSubmit} className={`relative ${compact ? 'px-3' : 'px-3 md:px-5'} py-3 border-t border-gray-800`}>
        {mention && mentionOptions.length > 0 && (
          <ul className="absolute left-3 right-3 md:left-5 md:right-auto md:w-80 bottom-full mb-1 z-30 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl py-1" role="listbox">
            {mentionOptions.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pickMention(m); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm ${i === mention.index ? 'bg-gray-800' : 'hover:bg-gray-800/60'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${m.status === 'active' ? 'bg-[#00b894]' : m.status === 'away' ? 'bg-[#fdcb6e]' : 'bg-gray-600'}`} />
                  <span className="truncate">{m.name}</span>
                  <span className="ml-auto text-xs text-gray-500 truncate">{m.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {(replyTo || editing) && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-gray-800/70 border-l-2 border-[#8b93ff] text-xs">
            <span className="text-gray-400 shrink-0">{editing ? 'Editing message' : `Replying to ${replyTo.author_name || replyTo.author_email || 'message'}`}</span>
            {!editing && <span className="truncate text-gray-500">{replyTo.body}</span>}
            <button
              type="button"
              onClick={() => { if (editing) { setBody(''); onCancelEdit?.(); } else onCancelReply?.(); }}
              className="ml-auto text-gray-500 hover:text-white"
              aria-label="Cancel"
            >
              ×
            </button>
          </div>
        )}
        {showLink && (
          <div className="mb-3 p-3 rounded-xl border border-gray-700 bg-gray-900/70">
            <p className="text-xs text-gray-400 mb-2">Share URL / presentation link</p>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-[#d63031]"
              />
              <input
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Title (optional)"
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-[#d63031]"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={addLinkAttachment}
                className="px-3 py-1.5 bg-[#d63031] hover:bg-[#c0392b] rounded-lg text-xs font-medium transition"
              >
                Attach Link
              </button>
              <button
                type="button"
                onClick={() => setShowLink(false)}
                className="px-3 py-1.5 border border-gray-700 hover:border-gray-500 rounded-lg text-xs text-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingAttachments.map((att, i) => (
              <div key={att.localId || i} className={`relative flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-xs overflow-hidden ${att.error ? 'ring-1 ring-red-500/60' : ''}`}>
                {att.previewUrl ? (
                  <img src={att.previewUrl} alt="" className="w-8 h-8 rounded object-cover" />
                ) : (
                  <span>{att.type === 'gdrive' ? '📄' : att.type === 'presentation' ? '📽️' : att.type === 'file' ? '📎' : '🔗'}</span>
                )}
                <span className="truncate max-w-[150px]">{att.error || att.title}</span>
                <button type="button" onClick={() => removeAttachment(i)} className="text-gray-500 hover:text-red-400" aria-label="Remove">×</button>
                {att.uploading && (
                  <span className="absolute left-0 bottom-0 h-0.5 bg-[#00b894] transition-all" style={{ width: `${Math.round((att.progress || 0) * 100)}%` }} />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 bg-gray-800 rounded-xl px-3 md:px-4 py-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-gray-500 hover:text-[#fdcb6e] transition p-1"
            title="Upload images or files"
            aria-label="Upload images or files"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
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
          <button
            type="button"
            onClick={() => setShowLink((v) => !v)}
            className="text-gray-500 hover:text-[#fdcb6e] transition p-1"
            title="Attach URL"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-1.414 1.414a4 4 0 01-5.657-5.657l1.414-1.414m3.536-3.536a4 4 0 015.657 5.657l-1.414 1.414a4 4 0 01-5.657-5.657" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            value={body}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={editing ? 'Edit your message' : placeholder || 'Message, @mention, link, or paste an image…'}
            rows={1}
            className="flex-1 bg-transparent resize-none text-base md:text-sm focus:outline-none placeholder:text-gray-500 max-h-32"
            style={{ minHeight: '24px' }}
          />
          <button
            type="submit"
            disabled={(!body.trim() && !pendingAttachments.length) || sending || uploading}
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
});

export default MessageInput;
