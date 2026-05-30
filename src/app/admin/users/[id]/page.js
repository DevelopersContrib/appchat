'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function UserDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`).then(r => r.json()).then(d => {
      setData(d);
      setForm({ name: d.user.name || '', email: d.user.email, isAdmin: !!d.user.is_admin });
    });
  }, [id]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/admin/users/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    router.push('/admin/users');
  }

  if (!data) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-white mb-4">&larr; Back</button>
      <h1 className="text-2xl font-bold mb-6">Edit User</h1>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Email</label>
          <input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Name</label>
          <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isAdmin || false} onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })} />
          Super Admin
        </label>
        <button type="submit" disabled={saving}
          className="px-6 py-2 bg-[#d63031] hover:bg-[#c0392b] text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      <div className="mt-8">
        <h2 className="font-semibold mb-3">Memberships</h2>
        <div className="space-y-2">
          {data.memberships.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm">
              <span>{m.tenant_name} <span className="text-gray-500">/{m.tenant_slug}</span></span>
              <span className="px-2 py-0.5 bg-gray-800 text-xs rounded">{m.role}</span>
            </div>
          ))}
          {!data.memberships.length && <p className="text-sm text-gray-500">No tenant memberships</p>}
        </div>
      </div>
    </div>
  );
}
