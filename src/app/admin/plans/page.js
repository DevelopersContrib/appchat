'use client';

import { useState, useEffect } from 'react';

export default function PlansPage() {
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);

  async function load() {
    const res = await fetch('/api/admin/plans');
    setPlans(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleSave(plan) {
    await fetch('/api/admin/plans', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: plan.id,
        priceCents: plan.price_cents,
        includedRoomMinutes: plan.included_room_minutes,
        includedAiMinutes: plan.included_ai_minutes,
        includedMessages: plan.included_messages,
        maxMembers: plan.max_members,
        maxChannels: plan.max_channels,
      }),
    });
    setEditing(null);
    load();
  }

  function fmt(v) { return v === -1 ? 'Unlimited' : v.toLocaleString(); }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Billing Plans</h1>
      <p className="text-sm text-gray-400 mb-6">Billing via <a href="https://paydirect.com" target="_blank" rel="noopener noreferrer" className="text-[#fdcb6e] hover:underline">PayDirect</a>. Edit plan limits below.</p>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <div key={p.id} className="p-6 rounded-xl bg-gray-900 border border-gray-800">
            <h3 className="font-semibold text-lg mb-1">{p.name}</h3>
            <div className="text-2xl font-bold text-[#d63031] mb-4">
              {p.price_cents === 0 ? 'Free' : `$${(p.price_cents / 100).toFixed(0)}`}
              {p.price_cents > 0 && <span className="text-sm text-gray-500">/seat/mo</span>}
            </div>

            {editing === p.id ? (
              <div className="space-y-2 text-sm">
                {[
                  ['price_cents', 'Price (cents)'],
                  ['included_room_minutes', 'Room mins (-1=unlimited)'],
                  ['included_ai_minutes', 'AI mins (-1=unlimited)'],
                  ['included_messages', 'Messages (-1=unlimited)'],
                  ['max_members', 'Max members (-1=unlimited)'],
                  ['max_channels', 'Max channels (-1=unlimited)'],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500">{label}</label>
                    <input type="number" value={p[key]}
                      onChange={(e) => setPlans(plans.map(pp => pp.id === p.id ? { ...pp, [key]: parseInt(e.target.value) } : pp))}
                      className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm" />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => handleSave(p)} className="px-3 py-1 bg-[#00b894] text-white rounded text-xs">Save</button>
                  <button onClick={() => { setEditing(null); load(); }} className="px-3 py-1 bg-gray-800 rounded text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <ul className="space-y-1.5 text-sm text-gray-400 mb-4">
                  <li>Room minutes: <span className="text-white">{fmt(p.included_room_minutes)}</span></li>
                  <li>AI minutes: <span className="text-white">{fmt(p.included_ai_minutes)}</span></li>
                  <li>Messages: <span className="text-white">{fmt(p.included_messages)}</span></li>
                  <li>Max members: <span className="text-white">{fmt(p.max_members)}</span></li>
                  <li>Max channels: <span className="text-white">{fmt(p.max_channels)}</span></li>
                  <li>Custom domain: <span className="text-white">{p.custom_domain ? 'Yes' : 'No'}</span></li>
                </ul>
                <button onClick={() => setEditing(p.id)} className="text-xs text-[#fdcb6e] hover:underline">Edit Limits</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
