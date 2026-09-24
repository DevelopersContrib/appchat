'use client';

import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Turn phone/desktop notifications on or off for this device.
export default function NotificationsButton({ className = '' }) {
  const [state, setState] = useState('loading'); // loading | unsupported | ios-install | off | on | blocked | unavailable
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return setState(ios && !standalone ? 'ios-install' : 'unsupported');
      }
      if (Notification.permission === 'denied') return setState('blocked');
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const { publicKey } = await fetch('/api/push').then((r) => r.json());
      if (!publicKey) return setState('unavailable');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setState(permission === 'denied' ? 'blocked' : 'off');
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setState(res.ok ? 'on' : 'off');
    } catch {
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading' || state === 'unsupported') return null;
  const base = 'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs';
  return (
    <div className={className}>
      {state === 'off' && (
        <button onClick={enable} disabled={busy} className={`${base} bg-gray-800 hover:bg-gray-700 text-gray-200`}>🔔 Turn on notifications</button>
      )}
      {state === 'on' && (
        <button onClick={disable} disabled={busy} className={`${base} text-gray-500 hover:text-gray-300`} title="Notifications are on for this device">🔔 Notifications on · turn off</button>
      )}
      {state === 'blocked' && <p className="text-[11px] text-gray-500 text-center">Notifications are blocked in your browser settings.</p>}
      {state === 'ios-install' && <p className="text-[11px] text-gray-500 text-center">On iPhone, install the app (Share → Add to Home Screen) to get notifications.</p>}
      {state === 'unavailable' && <p className="text-[11px] text-gray-500 text-center">Notifications aren’t set up on this server yet.</p>}
    </div>
  );
}
