'use client';

import { useState, useEffect } from 'react';

export default function DrivePicker({ onSelect, onClose }) {
  const [connected, setConnected] = useState(null);
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/gdrive').then(r => r.json()).then(d => {
      setConnected(d.connected);
      if (d.connected) loadFiles();
      else setLoading(false);
    });
  }, []);

  async function loadFiles(q) {
    setLoading(true);
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await fetch(`/api/gdrive/files${params}`);
    const data = await res.json();
    if (data.needsAuth) {
      setConnected(false);
      setLoading(false);
      return;
    }
    setFiles(data.files || []);
    setLoading(false);
  }

  async function connectDrive() {
    const res = await fetch('/api/gdrive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnTo: window.location.pathname }),
    });
    const { authUrl } = await res.json();
    window.location.href = authUrl;
  }

  function handleSearch(e) {
    e.preventDefault();
    loadFiles(search);
  }

  function getIcon(mimeType) {
    if (mimeType?.includes('folder')) return '📁';
    if (mimeType?.includes('document')) return '📄';
    if (mimeType?.includes('spreadsheet')) return '📊';
    if (mimeType?.includes('presentation')) return '📽️';
    if (mimeType?.includes('image')) return '🖼️';
    if (mimeType?.includes('pdf')) return '📕';
    if (mimeType?.includes('video')) return '🎬';
    return '📎';
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb > 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h3 className="font-semibold">Google Drive</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {connected === false ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 mb-4">Connect your Google Drive to share files in chat.</p>
            <button onClick={connectDrive} className="px-6 py-2 bg-[#d63031] hover:bg-[#c0392b] text-white rounded-lg text-sm font-medium transition">
              Connect Google Drive
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSearch} className="px-4 py-2 border-b border-gray-800">
              <input
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-[#d63031]"
              />
            </form>

            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading files...</div>
              ) : files.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No files found</div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => onSelect({
                        type: 'gdrive',
                        title: file.name,
                        url: file.webViewLink,
                        thumbnailUrl: file.thumbnailLink || null,
                        mimeType: file.mimeType,
                        sizeBytes: file.size ? parseInt(file.size) : null,
                        metadata: { driveId: file.id, iconLink: file.iconLink },
                      })}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-800/50 transition"
                    >
                      <span className="text-xl">{getIcon(file.mimeType)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatSize(file.size)}
                          {file.modifiedTime && ` · ${new Date(file.modifiedTime).toLocaleDateString()}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
