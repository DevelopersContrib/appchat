'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function TenantDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/tenants/${id}`).then(r => r.json()).then(d => {
      setData(d);
      setForm({
        name: d.tenant.name, slug: d.tenant.slug, domain: d.tenant.domain || '',
        logoUrl: d.tenant.logo_url || '', brandColor: d.tenant.brand_color || '#d63031',
        planId: d.tenant.plan_id || 1, crmWebhookUrl: d.tenant.crm_webhook_url || '',
      });
    });
  }, [id]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/admin/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    router.push('/admin/tenants');
  }

  if (!data) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-white mb-4">&larr; Back</button>
      <h1 className="text-2xl font-bold mb-6">Edit: {data.tenant.name}</h1>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Slug</label>
            <input value={form.slug || ''} onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Custom Domain</label>
            <input value={form.domain || ''} onChange={(e) => setForm({ ...form, domain: e.target.value })}
              placeholder="chat.customdomain.com"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Brand Color</label>
            <div className="flex gap-2">
              <input type="color" value={form.brandColor || '#d63031'} onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                className="w-10 h-10 rounded border border-gray-800 cursor-pointer" />
              <input value={form.brandColor || ''} onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Logo URL</label>
            <input value={form.logoUrl || ''} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-400 mb-1">CRM Webhook URL</label>
            <input value={form.crmWebhookUrl || ''} onChange={(e) => setForm({ ...form, crmWebhookUrl: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-[#d63031]" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Plan</label>
            <select value={form.planId || 1} onChange={(e) => setForm({ ...form, planId: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-[#d63031]">
              <option value={1}>Starter</option>
              <option value={2}>Professional</option>
              <option value={3}>Enterprise</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="px-6 py-2 bg-[#d63031] hover:bg-[#c0392b] text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      <div className="mt-10">
        <h2 className="font-semibold mb-3">Members ({data.members.length})</h2>
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-500 text-left">
              <th className="px-4 py-2 font-medium">Email</th><th className="px-4 py-2 font-medium">Role</th><th className="px-4 py-2 font-medium">Joined</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {data.members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2">{m.email}</td>
                  <td className="px-4 py-2"><span className="px-2 py-0.5 bg-gray-800 text-xs rounded">{m.role}</span></td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{new Date(m.joined_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-semibold mb-3">Channels ({data.channels.length})</h2>
        <div className="flex flex-wrap gap-2">
          {data.channels.map((c) => (
            <span key={c.id} className="px-3 py-1 bg-gray-900 border border-gray-800 rounded-lg text-sm">
              # {c.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
