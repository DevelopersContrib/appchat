'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function NewRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenant = searchParams.get('tenant') || '';
  const channelId = searchParams.get('channelId') || '';
  const channelName = searchParams.get('channelName') || 'channel';

  const [meetingAbout, setMeetingAbout] = useState('');
  const [expectedAttendees, setExpectedAttendees] = useState('');
  const [expectedContributions, setExpectedContributions] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const canCreate = useMemo(() => Boolean(tenant && channelId), [tenant, channelId]);

  async function startMeeting() {
    if (!canCreate || creating) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant,
          channelId: Number(channelId),
          name: `Call in #${channelName}`,
          agentConfig: {
            meetingAbout,
            expectedAttendees,
            expectedContributions,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create room');
      }

      const { livekitRoom } = await res.json();
      router.replace(`/room/${livekitRoom}`);
    } catch (err) {
      setError(err.message || 'Failed to create room');
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-800 bg-gray-900/85 p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-wide text-[#fdcb6e]">Brand Agent Setup</p>
        <h1 className="mt-2 text-2xl font-semibold">Start Agent Meeting</h1>
        <p className="text-sm text-gray-400 mt-1">
          Channel: <span className="text-gray-200">#{channelName}</span>
        </p>

        {!canCreate && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            Missing room context. Please start meeting from a channel.
          </p>
        )}

        <div className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">What is this meeting about?</label>
            <textarea
              value={meetingAbout}
              onChange={(e) => setMeetingAbout(e.target.value)}
              placeholder="Example: portfolio status, blockers, and launch timeline."
              rows={3}
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:outline-none focus:border-[#00b894]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Who are we expecting?</label>
            <input
              value={expectedAttendees}
              onChange={(e) => setExpectedAttendees(e.target.value)}
              placeholder="Example: Maida, Alex, Kathy, client team"
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:outline-none focus:border-[#00b894]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Expected contributions</label>
            <textarea
              value={expectedContributions}
              onChange={(e) => setExpectedContributions(e.target.value)}
              placeholder="Example: Alex reports metrics, Kathy presents roadmap, client confirms next actions."
              rows={3}
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:outline-none focus:border-[#00b894]"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={startMeeting}
            disabled={!canCreate || creating}
            className="rounded-xl bg-gradient-to-r from-[#00b894] to-[#00a783] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
          >
            {creating ? 'Creating meeting...' : 'Create & Join Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewRoomLoading() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-800 bg-gray-900/85 p-6 shadow-2xl">
        <p className="text-sm text-gray-400">Loading meeting setup...</p>
      </div>
    </div>
  );
}

export default function NewRoomPage() {
  return (
    <Suspense fallback={<NewRoomLoading />}>
      <NewRoomContent />
    </Suspense>
  );
}
