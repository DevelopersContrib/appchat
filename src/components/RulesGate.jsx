'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RulesGate({ tenantSlug, tenantName, rules }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    const res = await fetch(`/api/workspace/${encodeURIComponent(tenantSlug)}/rules`, { method: 'POST' });
    if (res.ok) router.refresh();
    else setBusy(false);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-950 text-gray-100 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-4">
        <h1 className="text-lg font-semibold">Welcome to {tenantName}</h1>
        <p className="text-sm text-gray-400">Please read and accept the workspace rules to continue.</p>
        <div className="max-h-[50dvh] overflow-y-auto rounded-xl bg-gray-950 border border-gray-800 p-4 text-sm whitespace-pre-wrap">{rules}</div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-[#00b894] w-4 h-4" />
          I’ve read and agree to the rules
        </label>
        <div className="flex gap-2">
          <button onClick={accept} disabled={!agreed || busy} className="px-4 py-2 rounded-lg bg-[#00b894] disabled:opacity-40 text-sm font-medium text-white">
            {busy ? 'Entering…' : 'Accept and enter'}
          </button>
          <form action="/api/auth/logout" method="post">
            <button className="px-4 py-2 rounded-lg bg-gray-800 text-sm">Sign out</button>
          </form>
        </div>
      </div>
    </div>
  );
}
