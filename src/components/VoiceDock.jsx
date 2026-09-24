'use client';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useIsSpeaking,
  useConnectionState,
} from '@livekit/components-react';

// Discord-style voice: "Join voice" in a channel dispatches `voice-join` ({ channelId }); the dock
// stays connected while you browse other channels until you leave.
export default function VoiceDock() {
  const [session, setSession] = useState(null); // { channelId, channelName, token, url }
  const [error, setError] = useState('');

  useEffect(() => {
    const join = async (e) => {
      const channelId = e.detail?.channelId;
      if (!channelId) return;
      setError('');
      if (session?.channelId === channelId) return;
      if (session) await leave(session.channelId);
      const res = await fetch(`/api/channels/${channelId}/voice`, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setError(d.error || 'Could not join voice');
      setSession({ channelId, channelName: d.channelName, token: d.token, url: d.url });
      window.dispatchEvent(new CustomEvent('voice-state', { detail: { channelId } }));
    };
    window.addEventListener('voice-join', join);
    return () => window.removeEventListener('voice-join', join);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function leave(channelId = session?.channelId) {
    if (!channelId) return;
    await fetch(`/api/channels/${channelId}/voice`, { method: 'DELETE' }).catch(() => {});
    setSession(null);
    window.dispatchEvent(new CustomEvent('voice-state', { detail: { channelId: null } }));
    window.dispatchEvent(new Event('appchat-roster-refresh'));
  }

  // Leaving the page (closing the tab) also leaves voice.
  useEffect(() => {
    if (!session) return;
    const bye = () => navigator.sendBeacon?.(`/api/channels/${session.channelId}/voice/leave`);
    window.addEventListener('pagehide', bye);
    return () => window.removeEventListener('pagehide', bye);
  }, [session]);

  if (!session) {
    return error ? (
      <div className="fixed bottom-4 left-4 z-50 rounded-xl bg-red-500/90 text-white text-xs px-3 py-2" role="alert" onClick={() => setError('')}>{error}</div>
    ) : null;
  }

  return (
    <LiveKitRoom
      serverUrl={session.url}
      token={session.token}
      connect
      audio
      video={false}
      onDisconnected={() => leave()}
      className="fixed z-50 bottom-3 left-3 right-3 md:right-auto md:w-72"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <RoomAudioRenderer />
      <VoicePanel channelName={session.channelName} onLeave={() => leave()} />
    </LiveKitRoom>
  );
}

function VoicePanel({ channelName, onLeave }) {
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const state = useConnectionState();

  return (
    <div className="rounded-2xl border border-[#00b894]/40 bg-gray-900/95 backdrop-blur shadow-2xl p-3">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${state === 'connected' ? 'bg-[#00b894]' : 'bg-[#fdcb6e] animate-pulse'}`} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#00b894]">{state === 'connected' ? 'Voice connected' : 'Connecting…'}</p>
          <p className="text-[11px] text-gray-400 truncate">🔊 #{channelName}</p>
        </div>
        <button
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          className={`w-8 h-8 rounded-full text-sm ${isMicrophoneEnabled ? 'bg-gray-800 hover:bg-gray-700' : 'bg-red-500/80 hover:bg-red-500'}`}
          title={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
          aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isMicrophoneEnabled ? '🎙️' : '🔇'}
        </button>
        <button onClick={onLeave} className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-sm" title="Leave voice" aria-label="Leave voice">
          📞
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {participants.map((p) => <VoiceAvatar key={p.identity} participant={p} />)}
      </div>
    </div>
  );
}

function VoiceAvatar({ participant }) {
  const speaking = useIsSpeaking(participant);
  let avatar = null;
  try {
    avatar = JSON.parse(participant.metadata || '{}').avatar;
  } catch {}
  const name = participant.name || participant.identity;
  return (
    <span title={`${name}${participant.isMicrophoneEnabled ? '' : ' (muted)'}`} className="relative">
      {avatar ? (
        <img src={avatar} alt={name} className={`w-8 h-8 rounded-full object-cover ring-2 transition ${speaking ? 'ring-[#00b894]' : 'ring-transparent'}`} />
      ) : (
        <span className={`w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold ring-2 transition ${speaking ? 'ring-[#00b894]' : 'ring-transparent'}`}>
          {name[0]?.toUpperCase()}
        </span>
      )}
      {!participant.isMicrophoneEnabled && <span className="absolute -bottom-1 -right-1 text-[10px]">🔇</span>}
    </span>
  );
}
