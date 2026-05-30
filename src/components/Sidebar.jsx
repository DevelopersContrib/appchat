'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Sidebar({ tenant, channels, user, role, currentSlug }) {
  const pathname = usePathname();
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newName, setNewName] = useState('');

  async function createChannel(e) {
    e.preventDefault();
    if (!newName.trim()) return;

    await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant: currentSlug, name: newName.trim() }),
    });

    setNewName('');
    setShowNewChannel(false);
    window.location.reload();
  }

  return (
    <aside
      className="w-64 flex flex-col border-r border-gray-800 bg-gray-900"
      style={{ borderColor: tenant.brand_color + '33' }}
    >
      <div className="p-4 border-b border-gray-800 flex items-center gap-3">
        {tenant.logo_url && (
          <img src={tenant.logo_url} alt="" className="h-7 w-7 rounded" />
        )}
        <div>
          <h2 className="font-semibold text-sm">{tenant.name}</h2>
          <p className="text-xs text-gray-500">{role}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
          Channels
          {['owner', 'admin'].includes(role) && (
            <button
              onClick={() => setShowNewChannel(!showNewChannel)}
              className="text-gray-400 hover:text-white text-lg leading-none"
            >
              +
            </button>
          )}
        </p>

        {showNewChannel && (
          <form onSubmit={createChannel} className="px-2 mb-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="channel-name"
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </form>
        )}

        {channels.map((ch) => {
          const href = `/${currentSlug}/c/${ch.id}`;
          const active = pathname === href;
          return (
            <Link
              key={ch.id}
              href={href}
              className={`block px-3 py-1.5 rounded text-sm transition ${
                active
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <span className="text-gray-600 mr-1">#</span>
              {ch.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
            {(user.name || user.email)[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name || user.email}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
