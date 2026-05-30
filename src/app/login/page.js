'use client';

import { useState, useEffect, useRef } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const magicRef = useRef(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://auth.magic.link/sdk';
    script.onload = () => {
      magicRef.current = new window.Magic(process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY);
    };
    document.head.appendChild(script);
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!magicRef.current) throw new Error('Auth loading, please try again');
      const didToken = await magicRef.current.auth.loginWithMagicLink({ email });

      const res = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ didToken }),
      });

      if (!res.ok) throw new Error('Authentication failed');

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
          <h1 className="text-2xl font-bold">
            <span className="text-blue-500">App</span>Chat
          </h1>
          <p className="text-gray-400 mt-2 text-sm">Sign in with your email</p>
        </div>

        {sent ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className="text-green-400 font-medium">Check your email</p>
            <p className="text-gray-400 text-sm mt-2">
              We sent a magic link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium text-sm transition"
            >
              {loading ? 'Sending link...' : 'Continue with Email'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
