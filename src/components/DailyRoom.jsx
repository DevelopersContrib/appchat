'use client';

import { useEffect, useRef, useState } from 'react';

export default function DailyRoom({ url, onLeave }) {
  const containerRef = useRef(null);
  const frameRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let frame;
    async function init() {
      try {
        const DailyIframe = (await import('@daily-co/daily-js')).default;

        frame = DailyIframe.createFrame(containerRef.current, {
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '12px',
          },
          showLeaveButton: true,
          showFullscreenButton: true,
          theme: {
            colors: {
              accent: '#2563eb',
              accentText: '#ffffff',
              background: '#0a0a0a',
              backgroundAccent: '#1a1a2e',
              baseText: '#e2e8f0',
              border: '#334155',
              mainAreaBg: '#0f172a',
              mainAreaBgAccent: '#1e293b',
              mainAreaText: '#f1f5f9',
              supportiveText: '#94a3b8',
            },
          },
        });

        frameRef.current = frame;

        frame.on('left-meeting', () => {
          onLeave?.();
        });

        await frame.join({ url });
      } catch (err) {
        setError(err.message);
      }
    }

    init();

    return () => {
      if (frameRef.current) {
        frameRef.current.destroy();
      }
    };
  }, [url, onLeave]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        <p>{error}</p>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full bg-gray-950 rounded-xl" />;
}
