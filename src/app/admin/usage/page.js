'use client';

import { useState, useEffect } from 'react';

export default function UsagePage() {
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    fetch('/api/admin/tenants?page=1').then(r => r.json()).then(d => setTenants(d.tenants));
  }, []);

  const period = new Date().toISOString().slice(0, 7);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Usage</h1>
      <p className="text-sm text-gray-400 mb-6">Current period: <span className="text-white">{period}</span></p>

      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-left text-gray-500">
            <th className="px-5 py-3 font-medium">Tenant</th>
            <th className="px-5 py-3 font-medium">Plan</th>
            <th className="px-5 py-3 font-medium">Members</th>
            <th className="px-5 py-3 font-medium">Channels</th>
            <th className="px-5 py-3 font-medium">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-800/50 transition">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <img src={t.logo_url} alt="" className="w-5 h-5 rounded" onError={(e) => { e.target.style.display = 'none'; }} />
                    <span className="font-medium">{t.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3"><span className="px-2 py-0.5 bg-gray-800 text-xs rounded">{t.plan_name || 'Starter'}</span></td>
                <td className="px-5 py-3 text-gray-400">{t.member_count}</td>
                <td className="px-5 py-3 text-gray-400">{t.channel_count}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 bg-[#00b894]/20 text-[#00b894] text-xs rounded">Active</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
