'use client';

import { useEffect, useState } from 'react';

const HEARTBEAT_MS = 30000;
const ROSTER_EVENT = 'appchat-presence';

/**
 * Reports where this user is (channel or meeting) while the app is open.
 * Sends right away, every 30s, and whenever the tab is hidden/shown so "away" is accurate.
 */
export function usePresenceBeacon({ tenant, channelId, room }) {
  useEffect(() => {
    let timezone;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {}

    const send = () => {
      const body = JSON.stringify({
        tenant,
        channelId,
        room,
        timezone,
        status: document.visibilityState === 'hidden' ? 'away' : 'active',
      });
      fetch('/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    };

    send();
    const timer = setInterval(send, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', send);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', send);
    };
  }, [tenant, channelId, room]);
}

// The sidebar polls the roster and shares it, so other components don't poll separately.
export function publishRoster(data) {
  window.__appchatRoster = data;
  window.dispatchEvent(new CustomEvent(ROSTER_EVENT, { detail: data }));
}

export function useRoster() {
  const [roster, setRoster] = useState(() => (typeof window !== 'undefined' ? window.__appchatRoster : null) || null);
  useEffect(() => {
    const onUpdate = (e) => setRoster(e.detail);
    window.addEventListener(ROSTER_EVENT, onUpdate);
    return () => window.removeEventListener(ROSTER_EVENT, onUpdate);
  }, []);
  return roster;
}

export function localTime(timezone) {
  if (!timezone) return null;
  try {
    return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: timezone });
  } catch {
    return null;
  }
}

export function lastSeen(value) {
  if (!value) return 'Offline';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 60) return `Last seen ${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  return `Last seen ${Math.floor(hours / 24)}d ago`;
}

export function PresenceDot({ status, className = '' }) {
  const color = status === 'active' ? 'bg-[#00b894]' : status === 'away' ? 'bg-[#fdcb6e]' : 'bg-gray-600';
  const label = status === 'active' ? 'Online' : status === 'away' ? 'Away' : 'Offline';
  return <span title={label} aria-label={label} className={`inline-block w-2.5 h-2.5 rounded-full ring-2 ring-gray-900 ${color} ${className}`} />;
}

// One line describing where someone is right now, e.g. "In #sales · 3:42 PM local".
export function describePresence(member) {
  if (!member) return '';
  const time = localTime(member.timezone);
  if (!member.online) return [lastSeen(member.lastSeenAt), time && `${time} local`].filter(Boolean).join(' · ');
  const where = member.status === 'away' ? 'Away' : member.voiceChannelId ? '🔊 In voice' : member.where?.label;
  return [where, time && `${time} local`].filter(Boolean).join(' · ');
}
