'use client';

export default function LinkPreview({ attachment }) {
  const meta = attachment.metadata ? (typeof attachment.metadata === 'string' ? JSON.parse(attachment.metadata) : attachment.metadata) : {};

  if (attachment.type === 'gdrive') {
    const isPresentation = attachment.mime_type?.includes('presentation') || /\.pptx?$/i.test(attachment.title || '');
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-3 mt-2 p-3 bg-gray-800/50 border border-gray-700/50 rounded-xl hover:border-gray-600 transition max-w-sm">
        <span className="text-2xl flex-shrink-0">
          {attachment.mime_type?.includes('folder') ? '📁' :
           attachment.mime_type?.includes('document') ? '📄' :
           attachment.mime_type?.includes('spreadsheet') ? '📊' :
           attachment.mime_type?.includes('presentation') ? '📽️' : '📎'}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-blue-400 truncate">{attachment.title}</p>
          <p className="text-xs text-gray-500">
            Google Drive{isPresentation ? ' · Presentation' : ''}
          </p>
        </div>
      </a>
    );
  }

  if (attachment.type === 'presentation') {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-3 mt-2 p-3 bg-gray-800/50 border border-[#fdcb6e]/20 rounded-xl hover:border-[#fdcb6e]/40 transition max-w-sm">
        <span className="text-2xl flex-shrink-0">📽️</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#fdcb6e] truncate">{attachment.title || 'Presentation'}</p>
          <p className="text-xs text-gray-500">Presentation Link</p>
        </div>
      </a>
    );
  }

  if (attachment.type === 'link' || attachment.type === 'website') {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer"
        className="block mt-2 rounded-xl overflow-hidden border border-gray-700/50 hover:border-gray-600 transition max-w-md">
        {attachment.thumbnail_url && (
          <div className="h-32 bg-gray-800 overflow-hidden">
            <img src={attachment.thumbnail_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-3 bg-gray-800/50">
          <p className="text-sm font-medium text-blue-400 truncate">{attachment.title}</p>
          {meta.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{meta.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            {meta.favicon && <img src={meta.favicon} alt="" className="w-3 h-3" />}
            <span className="text-[10px] text-gray-500">{meta.domain || new URL(attachment.url).hostname}</span>
          </div>
        </div>
      </a>
    );
  }

  const mime = attachment.mime_type || attachment.mimeType || '';
  const size = attachment.size_bytes || attachment.sizeBytes;

  if (attachment.type === 'file' && /^image\/(png|jpe?g|gif|webp|avif|heic|heif)$/i.test(mime)) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block mt-2 max-w-sm">
        <img src={attachment.url} alt={attachment.title || ''} loading="lazy"
          className="max-h-80 w-auto max-w-full rounded-xl border border-gray-700/50 bg-gray-900" />
      </a>
    );
  }

  if (attachment.type === 'file' && /^video\/(mp4|webm|quicktime)$/i.test(mime)) {
    return <video src={attachment.url} controls preload="metadata" className="mt-2 max-h-80 max-w-full rounded-xl bg-black" />;
  }

  return (
    <a href={attachment.url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-blue-400 hover:border-gray-600 transition max-w-full">
      📎 <span className="truncate">{attachment.title || 'Attachment'}</span>
      {size ? <span className="text-xs text-gray-500 shrink-0">{formatSize(size)}</span> : null}
    </a>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
