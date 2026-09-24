'use client';

import { useEffect, useState } from 'react';

// "Install app" for phones/desktop. Android/Chrome use the native prompt; iOS needs Share → Add to Home Screen.
export default function InstallAppButton({ className = '' }) {
  const [promptEvent, setPromptEvent] = useState(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setInstalled(!!standalone);
    // iPadOS Safari reports itself as a Mac; touch support gives it away.
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    const onPrompt = (e) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!promptEvent && !isIos)) return null;

  async function install() {
    if (promptEvent) {
      promptEvent.prompt();
      await promptEvent.userChoice.catch(() => {});
      setPromptEvent(null);
    } else {
      setShowIosHelp((v) => !v);
    }
  }

  return (
    <div className={className}>
      <button
        onClick={install}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" />
        </svg>
        Install app
      </button>
      {showIosHelp && (
        <p className="mt-2 text-[11px] text-gray-400 leading-snug">
          Tap the Share button in Safari, then <span className="text-gray-200">Add to Home Screen</span>.
        </p>
      )}
    </div>
  );
}
