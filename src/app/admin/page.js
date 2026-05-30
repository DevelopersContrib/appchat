'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;
  if (!stats) return <div className="p-8 text-red-400">Failed to load stats</div>;

  const cards = [
    { label: 'Tenants', value: stats.counts.tenants, color: '#d63031', href: '/admin/tenants' },
    { label: 'Users', value: stats.counts.users, color: '#fdcb6e', href: '/admin/users' },
    { label: 'Channels', value: stats.counts.channels, color: '#00b894', href: '#' },
    { label: 'Messages', value: stats.counts.messages, color: '#6c5ce7', href: '#' },
    { label: 'Total Rooms', value: stats.counts.rooms, color: '#e17055', href: '/admin/rooms' },
    { label: 'Active Rooms', value: stats.counts.activeRooms, color: '#00b894', href: '/admin/rooms' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="p-4 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition">
            <div className="text-3xl font-bold" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-gray-900 border border-gray-800">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-sm">Recent Tenants</h2>
            <Link href="/admin/tenants" className="text-xs text-[#d63031] hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-800">
            {stats.recentTenants.map((t) => (
              <Link key={t.id} href={`/admin/tenants/${t.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/50 transition">
                <div>
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-xs text-gray-500 ml-2">/{t.slug}</span>
                </div>
                <span className="text-xs text-gray-600">{new Date(t.created_at).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-gray-900 border border-gray-800">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-sm">Recent Users</h2>
            <Link href="/admin/users" className="text-xs text-[#d63031] hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-800">
            {stats.recentUsers.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/50 transition">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{u.email}</span>
                  {u.is_admin ? <span className="px-1.5 py-0.5 bg-[#d63031]/20 text-[#d63031] text-[10px] rounded">admin</span> : null}
                </div>
                <span className="text-xs text-gray-600">{new Date(u.created_at).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
