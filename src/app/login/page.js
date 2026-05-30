'use client';

import { useState, useEffect, useRef } from 'react';
import { Magic } from 'magic-sdk';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState('');
  const magicRef = useRef(null);

  useEffect(() => {
    const publishableKey = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
    if (!publishableKey) {
      setError('Magic is not configured. Missing NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY.');
      return;
    }

    try {
      magicRef.current = new Magic(publishableKey);
      setSdkReady(true);
    } catch {
      setError('Failed to initialize Magic SDK.');
    }
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!magicRef.current) throw new Error('Auth is still loading. Please try again in a moment.');
      const didToken = await magicRef.current.auth.loginWithMagicLink({ email });

      const res = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ didToken }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Authentication failed');
      }

      const { redirectTo } = await res.json();
      window.location.href = redirectTo || '/';
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="https://www.brandidentity.com/logo/appchat.com" alt="AppChat" className="h-10 mx-auto" />
          <p className="text-gray-400 mt-2 text-sm">Sign in with your email</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-[#d63031] text-sm"
          />
          {error && <p className="text-[#d63031] text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !sdkReady}
            className="w-full py-3 bg-[#d63031] hover:bg-[#c0392b] text-white disabled:opacity-50 rounded-lg font-medium text-sm transition"
          >
            {loading ? 'Sending link...' : (!sdkReady ? 'Loading auth...' : 'Continue with Email')}
          </button>
        </form>
      </div>
    </div>
  );
}
