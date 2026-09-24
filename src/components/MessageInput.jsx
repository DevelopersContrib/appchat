'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import DrivePicker from './DrivePicker.jsx';
import { useRoster } from './presence.jsx';
import { EMOJI_GROUPS, suggestShortcodes } from '@/lib/emoji-data.js';

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
  const [shortcode, setShortcode] = useState(null); // { query, start, index }
  const [panel, setPanel] = useState(null); // 'emoji' | 'gif'
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState(null);
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

  useImperativeHandle(ref, () => ({
    addFiles: uploadFiles,
    focus: () => inputRef.current?.focus(),
    openGifs: (q = '') => { setGifQuery(q); setPanel('gif'); },
  }));

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
    // ":ta" → emoji suggestions.
    const sc = /(^|\s):([a-z0-9_+-]{2,})$/i.exec(value.slice(0, caret));
    setShortcode(sc && !m ? { query: sc[2], start: caret - sc[2].length - 1, index: 0 } : null);
    // Let others see "typing…" (throttled).
    if (value.trim() && Date.now() - lastTypingPing.current > TYPING_PING_MS && channelId && !editing) {
      lastTypingPing.current = Date.now();
      fetch(`/api/channels/${channelId}/typing`, { method: 'POST' }).catch(() => {});
    }
  }

  const shortcodeOptions = shortcode ? suggestShortcodes(shortcode.query) : [];

  function insertAtCaret(text, replaceFrom) {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? body.length;
    const from = replaceFrom ?? caret;
    const next = body.slice(0, from) + text + body.slice(caret);
    setBody(next);
    setTimeout(() => {
      el?.focus();
      const pos = from + text.length;
      el?.setSelectionRange(pos, pos);
    }, 0);
  }

  function pickShortcode([, emoji]) {
    insertAtCaret(`${emoji} `, shortcode.start);
    setShortcode(null);
  }

  // GIF picker: trending on open, search as you type (GIPHY; hidden when not configured).
  useEffect(() => {
    if (panel !== 'gif') return;
    const t = setTimeout(() => {
      fetch(`/api/gifs?q=${encodeURIComponent(gifQuery)}`).then((r) => r.json()).then((d) => setGifs(d)).catch(() => setGifs({ enabled: false, gifs: [] }));
    }, 250);
    return () => clearTimeout(t);
  }, [panel, gifQuery]);

  async function sendGif(g) {
    setPanel(null);
    setGifQuery('');
    await onSend('', [{ type: 'file', title: g.title || 'GIF', url: g.url, mimeType: 'image/gif' }]);
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
    setShortcode(null);
    setPanel(null);
    await onSend(body, ready.length ? ready : undefined);
    lastTypingPing.current = 0;
    setBody('');
    setPendingAttachments([]);
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (shortcode && shortcodeOptions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setShortcode((m) => ({ ...m, index: (m.index + d + shortcodeOptions.length) % shortcodeOptions.length }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickShortcode(shortcodeOptions[shortcode.index] || shortcodeOptions[0]);
        return;
      }
      if (e.key === 'Escape') {
        setShortcode(null);
        return;
      }
    }
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
        {shortcode && shortcodeOptions.length > 0 && (
          <ul className="absolute left-3 right-3 md:left-5 md:right-auto md:w-72 bottom-full mb-1 z-30 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl py-1" role="listbox">
            {shortcodeOptions.map((opt, i) => (
              <li key={opt[0]}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pickShortcode(opt); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm ${i === shortcode.index ? 'bg-gray-800' : 'hover:bg-gray-800/60'}`}
                >
                  <span className="text-lg">{opt[1]}</span>
                  <span className="text-gray-300">:{opt[0]}:</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {panel === 'emoji' && (
          <div className="absolute left-3 md:left-5 bottom-full mb-1 z-30 w-[min(22rem,calc(100vw-1.5rem))] max-h-72 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl p-2">
            {EMOJI_GROUPS.map(([group, list]) => (
              <div key={group} className="mb-1">
                <p className="px-1 text-[10px] uppercase tracking-wide text-gray-500">{group}</p>
                <div className="grid grid-cols-8">
                  {list.split(' ').map((e) => (
                    <button key={e} type="button" onClick={() => insertAtCaret(e)} className="h-9 rounded hover:bg-gray-800 text-xl">{e}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {panel === 'gif' && (
          <div className="absolute left-3 right-3 md:left-5 md:right-auto md:w-[26rem] bottom-full mb-1 z-30 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl p-2">
            <input
              autoFocus
              value={gifQuery}
              onChange={(e) => setGifQuery(e.target.value)}
              placeholder="Search GIFs"
              className="w-full mb-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-base md:text-sm focus:outline-none"
            />
            {gifs && !gifs.enabled && <p className="p-3 text-xs text-gray-400">GIFs aren’t set up on this server yet (needs a GIPHY key).</p>}
            <div className="grid grid-cols-3 gap-1 max-h-64 overflow-y-auto">
              {gifs?.gifs?.map((g) => (
                <button key={g.id} type="button" onClick={() => sendGif(g)} className="rounded overflow-hidden bg-gray-800 hover:ring-2 hover:ring-[#00b894]">
                  <img src={g.preview} alt={g.title} loading="lazy" className="w-full h-24 object-cover" />
                </button>
              ))}
            </div>
            {gifs?.enabled && <p className="mt-1 text-[9px] text-right text-gray-600">Powered by GIPHY</p>}
          </div>
        )}
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
            onClick={() => setPanel((p) => (p === 'emoji' ? null : 'emoji'))}
            className={`transition p-1 text-lg leading-none ${panel === 'emoji' ? 'text-[#fdcb6e]' : 'text-gray-500 hover:text-[#fdcb6e]'}`}
            title="Emoji"
            aria-label="Emoji"
          >
            😊
          </button>
          <button
            type="button"
            onClick={() => setPanel((p) => (p === 'gif' ? null : 'gif'))}
            className={`transition px-1 text-[10px] font-bold border rounded ${panel === 'gif' ? 'text-[#fdcb6e] border-[#fdcb6e]' : 'text-gray-500 border-gray-600 hover:text-[#fdcb6e] hover:border-[#fdcb6e]'}`}
            title="GIF"
            aria-label="GIF"
          >
            GIF
          </button>
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
