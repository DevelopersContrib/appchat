'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export default function TenantsPage() {
  const [data, setData] = useState({ tenants: [], total: 0, page: 1, pages: 0 });
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', domain: '', brandColor: '#d63031' });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    const res = await fetch(`/api/admin/tenants?page=${page}&search=${search}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowCreate(false);
      setForm({ name: '', slug: '', domain: '', brandColor: '#d63031' });
      load();
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete tenant "${name}"? This removes all their channels, messages, and rooms.`)) return;
    await fetch(`/api/admin/tenants/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tenants</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-[#d63031] hover:bg-[#c0392b] text-white rounded-lg text-sm font-medium transition">
          + New Tenant
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 p-5 bg-gray-900 rounded-xl border border-gray-800 grid md:grid-cols-4 gap-4">
          <input placeholder="Name" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') })}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
          <input placeholder="Slug" required value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
          <input placeholder="Custom domain (optional)" value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
          <button type="submit" className="px-4 py-2 bg-[#00b894] hover:bg-[#00a381] text-white rounded-lg text-sm font-medium transition">Create</button>
        </form>
      )}

      <div className="mb-4">
        <input
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-[#d63031]"
        />
      </div>

      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="px-5 py-3 font-medium">Tenant</th>
              <th className="px-5 py-3 font-medium">Slug</th>
              <th className="px-5 py-3 font-medium">Domain</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Members</th>
              <th className="px-5 py-3 font-medium">Channels</th>
              <th className="px-5 py-3 font-medium">Created</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {data.tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-800/50 transition">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <img src={t.logo_url} alt="" className="w-6 h-6 rounded" onError={(e) => { e.target.style.display = 'none'; }} />
                    <span className="font-medium">{t.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-400">/{t.slug}</td>
                <td className="px-5 py-3 text-gray-400">{t.domain || '—'}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">{t.plan_name || 'Starter'}</span>
                </td>
                <td className="px-5 py-3 text-gray-400">{t.member_count}</td>
                <td className="px-5 py-3 text-gray-400">{t.channel_count}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/tenants/${t.id}`} className="text-xs text-[#fdcb6e] hover:underline">Edit</Link>
                    <button onClick={() => handleDelete(t.id, t.name)} className="text-xs text-red-400 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.pages > 1 && (
          <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-500">{data.total} total</span>
            <div className="flex gap-2">
              {Array.from({ length: data.pages }, (_, i) => (
                <button key={i} onClick={() => load(i + 1)}
                  className={`px-3 py-1 rounded text-xs ${data.page === i + 1 ? 'bg-[#d63031] text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
