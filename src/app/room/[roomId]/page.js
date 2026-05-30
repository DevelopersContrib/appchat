'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Room, Track, RoomEvent } from 'livekit-client';

function createBrandAgentAvatarTrack(brandLogoUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const logo = new Image();
  logo.crossOrigin = 'anonymous';
  if (brandLogoUrl) {
    logo.src = brandLogoUrl;
  }

  let running = true;
  const draw = () => {
    if (!running) return;
    ctx.fillStyle = '#12131a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(253, 203, 110, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    const size = 220;
    const x = (canvas.width - size) / 2;
    const y = (canvas.height - size) / 2 - 26;

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 15, 125, 0, Math.PI * 2);
    ctx.fill();

    if (logo.complete && logo.naturalWidth > 0) {
      ctx.drawImage(logo, x, y, size, size);
    } else {
      ctx.fillStyle = '#fdcb6e';
      ctx.font = 'bold 58px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AG', canvas.width / 2, canvas.height / 2 + 6);
    }

    ctx.fillStyle = '#fdcb6e';
    ctx.font = '600 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Brand Agent', canvas.width / 2, canvas.height - 68);

    ctx.fillStyle = '#7bf0cf';
    ctx.font = '500 20px sans-serif';
    ctx.fillText('Live facilitation active', canvas.width / 2, canvas.height - 34);
  };

  draw();
  const interval = window.setInterval(draw, 700);
  const stream = canvas.captureStream(8);
  const track = stream.getVideoTracks()[0];

  return {
    track,
    stop: () => {
      running = false;
      clearInterval(interval);
      track.stop();
    },
  };
}

export default function RoomPage() {
  const { roomId } = useParams();
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [LiveKitUI, setLiveKitUI] = useState(null);
  const [connectNow, setConnectNow] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [agentPresence, setAgentPresence] = useState('offline');
  const [agentBrandDomain, setAgentBrandDomain] = useState('');
  const [agentBrandLogo, setAgentBrandLogo] = useState('');

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

  useEffect(() => {
    let disposed = false;
    let agentRoom = null;
    let avatarPublisher = null;
    let inFlightReply = false;
    let lastReplyAt = 0;

    async function connectBrandAgentParticipant() {
      if (!connectNow || !token) return;
      setAgentPresence('connecting');
      try {
        const res = await fetch('/api/livekit/agent-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: roomId }),
        });
        if (!res.ok) {
          setAgentPresence('offline');
          return;
        }

        const data = await res.json();
        if (!data?.token || !process.env.NEXT_PUBLIC_LIVEKIT_URL) {
          setAgentPresence('offline');
          return;
        }
        if (data.brandDomain) {
          setAgentBrandDomain(data.brandDomain);
        }
        if (data.brandLogo) {
          setAgentBrandLogo(data.brandLogo);
        }

        agentRoom = new Room({
          adaptiveStream: false,
          dynacast: false,
        });
        await agentRoom.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, data.token, {
          autoSubscribe: false,
        });

        avatarPublisher = createBrandAgentAvatarTrack(data.brandLogo || null);
        if (avatarPublisher?.track) {
          await agentRoom.localParticipant.publishTrack(avatarPublisher.track, {
            source: Track.Source.Camera,
            name: 'brand-agent-avatar',
          });
        }

        const greetedKey = `brand-agent-greeted-${roomId}`;
        const hasGreeted = typeof window !== 'undefined' && window.sessionStorage.getItem(greetedKey);
        if (!hasGreeted) {
          await agentRoom.localParticipant.sendText(
            'Hi everyone, Brand Agent here. Happy to support this conversation.'
          );
          await agentRoom.localParticipant.sendText(
            'To align quickly: what is the key outcome we need by the end of this meeting?'
          );
          await agentRoom.localParticipant.sendText(
            'Who is expected to contribute to each major decision today?'
          );
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(greetedKey, '1');
          }
        }

        agentRoom.on(RoomEvent.ChatMessage, async (msg, participant) => {
          if (disposed || inFlightReply) return;
          if (!msg?.message?.trim()) return;
          if (!participant?.identity) return;
          if (participant.identity.startsWith('brand-agent-')) return;
          const now = Date.now();
          if (now - lastReplyAt < 2500) return;

          inFlightReply = true;
          try {
            const replyRes = await fetch('/api/livekit/agent-reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                room: roomId,
                message: msg.message,
                sender: participant.name || participant.identity,
              }),
            });
            if (!replyRes.ok) return;
            const data = await replyRes.json();
            if (!data?.reply) return;
            await agentRoom.localParticipant.sendText(data.reply);
            lastReplyAt = Date.now();
          } catch {
            // no-op
          } finally {
            inFlightReply = false;
          }
        });

        agentRoom.on(RoomEvent.DataReceived, async (payload, participant) => {
          if (disposed || inFlightReply) return;
          if (!participant?.identity || participant.identity.startsWith('brand-agent-')) return;

          let parsed = null;
          try {
            const text = new TextDecoder().decode(payload);
            parsed = JSON.parse(text);
          } catch {
            return;
          }

          const incomingMessage = typeof parsed?.message === 'string' ? parsed.message.trim() : '';
          if (!incomingMessage) return;

          const now = Date.now();
          if (now - lastReplyAt < 2500) return;

          inFlightReply = true;
          try {
            const replyRes = await fetch('/api/livekit/agent-reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                room: roomId,
                message: incomingMessage,
                sender: participant.name || participant.identity,
              }),
            });
            if (!replyRes.ok) return;
            const data = await replyRes.json();
            if (!data?.reply) return;
            await agentRoom.localParticipant.sendText(data.reply);
            lastReplyAt = Date.now();
          } catch {
            // no-op
          } finally {
            inFlightReply = false;
          }
        });

        if (disposed) {
          agentRoom.disconnect();
          return;
        }
        setAgentPresence('online');
      } catch {
        setAgentPresence('offline');
      }
    }

    connectBrandAgentParticipant();

    return () => {
      disposed = true;
      if (agentRoom) {
        agentRoom.disconnect();
      }
      if (avatarPublisher) {
        avatarPublisher.stop();
      }
      setAgentPresence('offline');
    };
  }, [connectNow, token, roomId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-red-400 px-6">
        <div className="text-center max-w-md">
          <p className="text-lg font-semibold">Unable to join meeting</p>
          <p className="text-sm mt-2 text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!token || !LiveKitUI) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#00b894] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-300 mt-4 text-sm font-medium">Preparing secure room...</p>
          <p className="text-gray-500 mt-1 text-xs">Connecting audio, video, and agent presence</p>
        </div>
      </div>
    );
  }

  const { LiveKitRoom, VideoConference, RoomAudioRenderer } = LiveKitUI;

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800/80 bg-gray-950/90 backdrop-blur px-4 py-2.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://www.brandidentity.com/logo/appchat.com" alt="AppChat" className="h-6" />
            <span className="text-xs text-gray-500">Live Agent Meeting</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#00b894]/15 px-2.5 py-1 text-[10px] font-medium uppercase text-[#00b894]">
              Secure Live
            </span>
            <button
              onClick={() => window.close()}
              className="rounded-md border border-gray-700 px-2.5 py-1 text-[10px] font-medium uppercase text-gray-300 transition hover:border-gray-500"
            >
              Close
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {}
              }}
              className="rounded-md border border-gray-700 px-2.5 py-1 text-[10px] font-medium uppercase text-gray-300 transition hover:border-gray-500"
            >
              {copied ? 'Copied' : 'Invite People'}
            </button>
          </div>
        </div>
      </div>
      {!connectNow ? (
        <div className="flex h-[calc(100vh-45px)] items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <p className="text-xs uppercase tracking-wider text-[#fdcb6e]">Ready to Join</p>
            <h1 className="mt-2 text-xl font-semibold">Agent Meeting Room</h1>
            <p className="mt-1 text-xs text-gray-500">
              Room: <span className="text-gray-300">{roomId}</span>
            </p>

            <div className="mt-5 space-y-3">
              <label className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3 text-sm">
                <span className="text-gray-300">Start with camera</span>
                <input
                  type="checkbox"
                  checked={videoEnabled}
                  onChange={(e) => setVideoEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[#00b894]"
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3 text-sm">
                <span className="text-gray-300">Start with microphone</span>
                <input
                  type="checkbox"
                  checked={audioEnabled}
                  onChange={(e) => setAudioEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[#00b894]"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-[#fdcb6e]/30 bg-[#fdcb6e]/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-[#fdcb6e] font-semibold">Agent Presence</p>
              <p className="text-xs text-gray-300 mt-1">
                Brand Agent joins this room automatically and posts summaries back to channel chat.
              </p>
            </div>

            <button
              onClick={() => setConnectNow(true)}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#00b894] to-[#00a783] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Join Secure Meeting
            </button>
          </div>
        </div>
      ) : (
        <LiveKitRoom
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          token={token}
          connect={true}
          video={videoEnabled}
          audio={audioEnabled}
          style={{ height: 'calc(100vh - 45px)' }}
          data-lk-theme="default"
          className="appchat-livekit"
        >
          <div className="relative h-full">
            <VideoConference />

            <div className="pointer-events-none absolute right-4 top-4 hidden md:block">
              <div className="w-72 rounded-2xl border border-[#fdcb6e]/25 bg-gray-950/85 p-4 backdrop-blur shadow-2xl shadow-black/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {agentBrandDomain ? (
                      <img
                        src={agentBrandLogo || `https://www.brandidentity.com/favicon/${agentBrandDomain}`}
                        alt="Brand"
                        className="w-4 h-4 rounded-sm"
                      />
                    ) : null}
                    <p className="text-xs font-semibold tracking-wide text-[#fdcb6e] uppercase">Brand Agent</p>
                  </div>
                  {agentPresence === 'online' ? (
                    <span className="rounded-full bg-[#00b894]/20 px-2 py-0.5 text-[10px] uppercase text-[#00b894]">
                      Online
                    </span>
                  ) : agentPresence === 'connecting' ? (
                    <span className="rounded-full bg-[#fdcb6e]/20 px-2 py-0.5 text-[10px] uppercase text-[#fdcb6e]">
                      Joining
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-700/60 px-2 py-0.5 text-[10px] uppercase text-gray-300">
                      Offline
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Live facilitation active. The agent can ask clarifying questions and summarize decisions.
                </p>
              </div>
            </div>

            <div className="pointer-events-none absolute left-4 bottom-4">
              <span className="rounded-full border border-[#00b894]/30 bg-[#00b894]/15 px-3 py-1 text-[11px] font-medium text-[#7bf0cf]">
                Agent in Room
              </span>
            </div>
          </div>
          <RoomAudioRenderer />
        </LiveKitRoom>
      )}
    </div>
  );
}
