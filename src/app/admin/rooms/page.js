'use client';

import { useState, useEffect } from 'react';

export default function RoomsPage() {
  const [rooms, setRooms] = useState([]);

  async function load() {
    const res = await fetch('/api/admin/stats');
    const stats = await res.json();
    const tenantsRes = await fetch('/api/admin/tenants?page=1');
    const td = await tenantsRes.json();
    const allRooms = [];
    for (const t of td.tenants) {
      const tRes = await fetch(`/api/admin/tenants/${t.id}`);
      const tData = await tRes.json();
      allRooms.push(...tData.rooms.map(r => ({ ...r, tenant_name: t.name, tenant_slug: t.slug })));
    }
    setRooms(allRooms.sort((a, b) => new Date(b.started_at) - new Date(a.started_at)));
  }

  useEffect(() => { load(); }, []);

  async function endRoom(id) {
    await fetch(`/api/admin/rooms/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ended' }),
    });
    load();
  }

  async function deleteRoom(id) {
    if (!confirm('Delete this room?')) return;
    await fetch(`/api/admin/rooms/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Rooms</h1>

      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-left text-gray-500">
            <th className="px-5 py-3 font-medium">Room</th>
            <th className="px-5 py-3 font-medium">Tenant</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Started</th>
            <th className="px-5 py-3 font-medium"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {rooms.map((r) => (
              <tr key={r.id} className="hover:bg-gray-800/50 transition">
                <td className="px-5 py-3 font-medium">{r.name || r.livekit_room}</td>
                <td className="px-5 py-3 text-gray-400">{r.tenant_name}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    r.status === 'active' ? 'bg-[#00b894]/20 text-[#00b894]' :
                    r.status === 'waiting' ? 'bg-[#fdcb6e]/20 text-[#fdcb6e]' :
                    'bg-gray-800 text-gray-400'
                  }`}>{r.status}</span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-500">{new Date(r.started_at).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {r.status !== 'ended' && (
                      <button onClick={() => endRoom(r.id)} className="text-xs text-[#fdcb6e] hover:underline">End</button>
                    )}
                    <button onClick={() => deleteRoom(r.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {!rooms.length && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No rooms yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
