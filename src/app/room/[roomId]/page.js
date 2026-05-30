'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

export default function RoomPage() {
  const { roomId } = useParams();
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [LiveKitUI, setLiveKitUI] = useState(null);

  const getToken = useCallback(async () => {
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to get token');
        return;
      }

      const { token: jwt } = await res.json();
      setToken(jwt);
    } catch (err) {
      setError(err.message);
    }
  }, [roomId]);

  useEffect(() => {
    getToken();
  }, [getToken]);

  useEffect(() => {
    import('@livekit/components-react').then((mod) => {
      setLiveKitUI(mod);
    });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-red-400">
        <div className="text-center">
          <p className="text-lg font-medium">Unable to join room</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!token || !LiveKitUI) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 mt-4 text-sm">Connecting to room...</p>
        </div>
      </div>
    );
  }

  const { LiveKitRoom, VideoConference, RoomAudioRenderer } = LiveKitUI;

  return (
    <div className="min-h-screen bg-gray-950">
      <LiveKitRoom
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        token={token}
        connect={true}
        video={true}
        audio={true}
        style={{ height: '100vh' }}
        data-lk-theme="default"
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
