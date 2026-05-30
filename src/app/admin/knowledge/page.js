'use client';

import { useState, useEffect } from 'react';

export default function KnowledgePage() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [data, setData] = useState({ knowledge: [], websites: [] });
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ url: '', label: '', title: '', content: '' });
  const [addType, setAddType] = useState(null);

  useEffect(() => {
    fetch('/api/admin/tenants?page=1').then(r => r.json()).then(d => setTenants(d.tenants));
  }, []);

  async function loadKnowledge(tenantId) {
    setLoading(true);
    const res = await fetch(`/api/admin/knowledge?tenantId=${tenantId}`);
    setData(await res.json());
    setLoading(false);
  }

  function selectTenant(t) {
    setSelectedTenant(t);
    loadKnowledge(t.id);
  }

  async function addWebsite(e) {
    e.preventDefault();
    await fetch('/api/admin/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: selectedTenant.id, action: 'add_website', url: form.url, label: form.label }),
    });
    setForm({ url: '', label: '', title: '', content: '' });
    setAddType(null);
    loadKnowledge(selectedTenant.id);
  }

  async function addManual(e) {
    e.preventDefault();
    await fetch('/api/admin/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: selectedTenant.id, action: 'add_manual', title: form.title, content: form.content }),
    });
    setForm({ url: '', label: '', title: '', content: '' });
    setAddType(null);
    loadKnowledge(selectedTenant.id);
  }

  async function recrawl(url) {
    await fetch('/api/admin/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: selectedTenant.id, action: 'crawl_website', url }),
    });
    loadKnowledge(selectedTenant.id);
  }

  async function deleteKnowledge(id) {
    if (!confirm('Delete this knowledge entry?')) return;
    await fetch(`/api/admin/knowledge/${id}`, { method: 'DELETE' });
    loadKnowledge(selectedTenant.id);
  }

  const sourceIcon = { gdrive: '📄', website: '🌐', brandidentity: '🎨', manual: '📝' };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Brand Knowledge</h1>
      <p className="text-sm text-gray-400 mb-6">Manage what the AI agent knows about each brand during meetings.</p>

      <div className="flex gap-6">
        <div className="w-56 flex-shrink-0">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Select Tenant</p>
          <div className="space-y-1">
            {tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTenant(t)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                  selectedTenant?.id === t.id ? 'bg-[#d63031]/20 text-[#d63031]' : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {!selectedTenant ? (
            <div className="text-gray-500 text-sm">Select a tenant to manage their brand knowledge.</div>
          ) : loading ? (
            <div className="text-gray-500 text-sm">Loading...</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">{selectedTenant.name} — Knowledge Base</h2>
                <div className="flex gap-2">
                  <button onClick={() => setAddType('website')} className="px-3 py-1.5 bg-[#00b894] hover:bg-[#00a381] text-white rounded-lg text-xs font-medium transition">
                    + Website
                  </button>
                  <button onClick={() => setAddType('manual')} className="px-3 py-1.5 bg-[#fdcb6e] hover:bg-[#f9c846] text-gray-900 rounded-lg text-xs font-medium transition">
                    + Manual Entry
                  </button>
                </div>
              </div>

              {addType === 'website' && (
                <form onSubmit={addWebsite} className="mb-4 p-4 bg-gray-900 rounded-xl border border-gray-800 grid grid-cols-3 gap-3">
                  <input placeholder="https://vnoc.com" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-[#00b894]" />
                  <input placeholder="Label (e.g. Homepage)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-[#00b894]" />
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-[#00b894] text-white rounded-lg text-xs font-medium">Add & Crawl</button>
                    <button type="button" onClick={() => setAddType(null)} className="px-3 py-2 text-gray-500 text-xs">Cancel</button>
                  </div>
                </form>
              )}

              {addType === 'manual' && (
                <form onSubmit={addManual} className="mb-4 p-4 bg-gray-900 rounded-xl border border-gray-800 space-y-3">
                  <input placeholder="Title (e.g. Company Overview)" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-[#fdcb6e]" />
                  <textarea placeholder="Enter brand information the AI should know..." required rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-[#fdcb6e] resize-none" />
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-[#fdcb6e] text-gray-900 rounded-lg text-xs font-medium">Save</button>
                    <button type="button" onClick={() => setAddType(null)} className="px-3 py-2 text-gray-500 text-xs">Cancel</button>
                  </div>
                </form>
              )}

              {data.websites.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Tracked Websites</p>
                  <div className="flex flex-wrap gap-2">
                    {data.websites.map((w) => (
                      <div key={w.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs">
                        <span className={w.status === 'crawled' ? 'text-[#00b894]' : w.status === 'error' ? 'text-[#d63031]' : 'text-[#fdcb6e]'}>●</span>
                        <span>{w.label || w.url}</span>
                        <button onClick={() => recrawl(w.url)} className="text-gray-500 hover:text-white" title="Re-crawl">↻</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-800 text-left text-gray-500">
                    <th className="px-4 py-2 font-medium">Source</th>
                    <th className="px-4 py-2 font-medium">Title</th>
                    <th className="px-4 py-2 font-medium">Size</th>
                    <th className="px-4 py-2 font-medium">Last Synced</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-800">
                    {data.knowledge.map((k) => (
                      <tr key={k.id} className="hover:bg-gray-800/50">
                        <td className="px-4 py-2">
                          <span className="mr-1">{sourceIcon[k.source_type]}</span>
                          <span className="text-xs text-gray-500">{k.source_type}</span>
                        </td>
                        <td className="px-4 py-2 font-medium truncate max-w-[200px]">{k.title}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{(k.content?.length / 1000).toFixed(1)}K chars</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{new Date(k.last_synced_at).toLocaleDateString()}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => deleteKnowledge(k.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {!data.knowledge.length && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No knowledge entries yet. Add websites or manual entries above.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
