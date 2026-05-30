'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export default function UsersPage() {
  const [data, setData] = useState({ users: [], total: 0, page: 1, pages: 0 });
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', isAdmin: false });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?page=${page}&search=${search}`);
    setData(await res.json());
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) { setShowCreate(false); setForm({ email: '', name: '', isAdmin: false }); load(); }
  }

  async function handleDelete(id, email) {
    if (!confirm(`Delete user "${email}"?`)) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-[#d63031] hover:bg-[#c0392b] text-white rounded-lg text-sm font-medium transition">
          + New User
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 p-5 bg-gray-900 rounded-xl border border-gray-800 grid md:grid-cols-4 gap-4 items-end">
          <input placeholder="Email" required type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
          <input placeholder="Name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" checked={form.isAdmin} onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })}
              className="rounded" />
            Admin
          </label>
          <button type="submit" className="px-4 py-2 bg-[#00b894] hover:bg-[#00a381] text-white rounded-lg text-sm font-medium transition">Create</button>
        </form>
      )}

      <div className="mb-4">
        <input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
      </div>

      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-left text-gray-500">
            <th className="px-5 py-3 font-medium">Email</th>
            <th className="px-5 py-3 font-medium">Name</th>
            <th className="px-5 py-3 font-medium">Role</th>
            <th className="px-5 py-3 font-medium">Tenants</th>
            <th className="px-5 py-3 font-medium">Last Seen</th>
            <th className="px-5 py-3 font-medium"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {data.users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-800/50 transition">
                <td className="px-5 py-3 font-medium">{u.email}</td>
                <td className="px-5 py-3 text-gray-400">{u.name || '—'}</td>
                <td className="px-5 py-3">
                  {u.is_admin ? <span className="px-2 py-0.5 bg-[#d63031]/20 text-[#d63031] text-xs rounded">admin</span>
                    : <span className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">user</span>}
                </td>
                <td className="px-5 py-3 text-xs text-gray-500">{u.tenants || '—'}</td>
                <td className="px-5 py-3 text-xs text-gray-500">{u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString() : 'Never'}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/users/${u.id}`} className="text-xs text-[#fdcb6e] hover:underline">Edit</Link>
                    <button onClick={() => handleDelete(u.id, u.email)} className="text-xs text-red-400 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
