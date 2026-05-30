'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create organization');
      }

      const { slug: createdSlug } = await res.json();
      router.push(`/${createdSlug}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <img src="https://www.brandidentity.com/logo/appchat.com" alt="AppChat" className="h-10 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-center mb-2">Create your organization</h1>
        <p className="text-gray-400 text-sm text-center mb-8">
          Set up your team workspace on AppChat.
        </p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Organization name</label>
            <input
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
              }}
              placeholder="Acme Corp"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">URL slug</label>
            <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg overflow-hidden focus-within:border-blue-500">
              <span className="text-gray-500 text-sm pl-4">appchat.com/</span>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="flex-1 px-1 py-3 bg-transparent focus:outline-none text-sm"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium text-sm transition"
          >
            {loading ? 'Creating...' : 'Create Organization'}
          </button>
        </form>
      </div>
    </div>
  );
}
