'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = ['Organization', 'Branding', 'Channels', 'Invite'];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
            i < current ? 'bg-blue-600 text-white' :
            i === current ? 'bg-blue-600 text-white ring-2 ring-blue-400/50 ring-offset-2 ring-offset-gray-950' :
            'bg-gray-800 text-gray-500'
          }`}>
            {i < current ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-12 h-0.5 ${i < current ? 'bg-blue-600' : 'bg-gray-800'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function OrgStep({ data, onChange, onNext }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Create your organization</h2>
        <p className="text-sm text-gray-400">This is your team&apos;s workspace on AppChat.</p>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Organization name</label>
        <input
          autoFocus
          required
          value={data.name}
          onChange={(e) => onChange({
            name: e.target.value,
            slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          })}
          placeholder="Acme Corp"
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">URL</label>
        <div className="flex items-center bg-gray-900 border border-gray-700 rounded-xl overflow-hidden focus-within:border-blue-500">
          <span className="text-gray-500 text-sm pl-4 flex-shrink-0">appchat.com/</span>
          <input
            required
            value={data.slug}
            onChange={(e) => onChange({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            className="flex-1 px-1 py-3 bg-transparent focus:outline-none text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">What&apos;s this workspace for?</label>
        <select
          value={data.purpose}
          onChange={(e) => onChange({ purpose: e.target.value })}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 text-sm"
        >
          <option value="">Select...</option>
          <option value="sales">Sales & Outreach</option>
          <option value="support">Client Support</option>
          <option value="team">Internal Team Chat</option>
          <option value="portfolio">Portfolio Management</option>
          <option value="other">Other</option>
        </select>
      </div>
      <button
        onClick={onNext}
        disabled={!data.name || !data.slug}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl font-medium text-sm transition"
      >
        Continue
      </button>
    </div>
  );
}

function BrandingStep({ data, onChange, onNext, onBack }) {
  const colors = ['#2563eb', '#7c3aed', '#059669', '#dc2626', '#ea580c', '#0891b2', '#4f46e5', '#be185d'];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Brand your workspace</h2>
        <p className="text-sm text-gray-400">Make it yours. Your team and guests will see this branding.</p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Logo URL</label>
        <input
          value={data.logoUrl}
          onChange={(e) => onChange({ logoUrl: e.target.value })}
          placeholder={`https://brandidentity.com/logo/${data.slug || 'your-domain'}.com`}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 text-sm"
        />
        {(data.logoUrl || data.slug) && (
          <div className="mt-3 p-4 bg-gray-900 rounded-xl border border-gray-800 flex items-center gap-3">
            <img
              src={data.logoUrl || `https://www.brandidentity.com/logo/${data.slug}.com`}
              alt="Preview"
              className="h-10"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <span className="text-sm text-gray-400">Logo preview</span>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Brand color</label>
        <div className="flex gap-2 flex-wrap">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ brandColor: c })}
              className={`w-10 h-10 rounded-xl transition-all ${
                data.brandColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950 scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">CRM webhook URL <span className="text-gray-600">(optional)</span></label>
        <input
          value={data.crmWebhook}
          onChange={(e) => onChange({ crmWebhook: e.target.value })}
          placeholder="https://your-crm.com/api/webhook"
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 text-sm"
        />
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border border-gray-700 hover:border-gray-500 rounded-xl font-medium text-sm transition">
          Back
        </button>
        <button onClick={onNext} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium text-sm transition">
          Continue
        </button>
      </div>
    </div>
  );
}

function ChannelsStep({ data, onChange, onNext, onBack }) {
  const presets = {
    sales: ['general', 'deals', 'prospects', 'wins'],
    support: ['general', 'tickets', 'feedback', 'announcements'],
    team: ['general', 'random', 'standup', 'announcements'],
    portfolio: ['general', 'deal-room', 'partnerships', 'onboarding'],
    other: ['general'],
  };

  const suggested = presets[data.purpose] || presets.other;

  function toggleChannel(ch) {
    const current = data.channels || [];
    if (current.includes(ch)) {
      onChange({ channels: current.filter((c) => c !== ch) });
    } else {
      onChange({ channels: [...current, ch] });
    }
  }

  if (!data.channels?.length && suggested.length) {
    onChange({ channels: [...suggested] });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Set up channels</h2>
        <p className="text-sm text-gray-400">Choose starting channels. You can always add more later.</p>
      </div>

      <div className="space-y-2">
        {suggested.map((ch) => (
          <label
            key={ch}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
              (data.channels || []).includes(ch)
                ? 'bg-blue-600/10 border-blue-500/30'
                : 'bg-gray-900 border-gray-800 hover:border-gray-700'
            }`}
          >
            <input
              type="checkbox"
              checked={(data.channels || []).includes(ch)}
              onChange={() => toggleChannel(ch)}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
              (data.channels || []).includes(ch) ? 'bg-blue-600' : 'bg-gray-800'
            }`}>
              {(data.channels || []).includes(ch) && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm"><span className="text-gray-500">#</span> {ch}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border border-gray-700 hover:border-gray-500 rounded-xl font-medium text-sm transition">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!(data.channels || []).length}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl font-medium text-sm transition"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function InviteStep({ data, onChange, onSubmit, onBack, loading }) {
  function addEmail() {
    const current = data.inviteEmails || [];
    onChange({ inviteEmails: [...current, ''] });
  }

  function updateEmail(i, val) {
    const current = [...(data.inviteEmails || [])];
    current[i] = val;
    onChange({ inviteEmails: current });
  }

  function removeEmail(i) {
    const current = [...(data.inviteEmails || [])];
    current.splice(i, 1);
    onChange({ inviteEmails: current });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Invite your team</h2>
        <p className="text-sm text-gray-400">Add team members now, or skip and invite later.</p>
      </div>

      <div className="space-y-2">
        {(data.inviteEmails || []).map((email, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => updateEmail(i, e.target.value)}
              placeholder="colleague@company.com"
              className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 text-sm"
            />
            <button
              onClick={() => removeEmail(i)}
              className="px-3 text-gray-500 hover:text-red-400 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addEmail}
        className="w-full py-2.5 border border-dashed border-gray-700 hover:border-gray-500 rounded-xl text-sm text-gray-400 hover:text-white transition"
      >
        + Add team member
      </button>

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="flex-1 py-3 border border-gray-700 hover:border-gray-500 rounded-xl font-medium text-sm transition">
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={loading}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-medium text-sm transition"
        >
          {loading ? 'Creating workspace...' : (data.inviteEmails || []).filter(Boolean).length ? 'Create & Send Invites' : 'Create Workspace'}
        </button>
      </div>
    </div>
  );
}

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    name: '',
    slug: '',
    purpose: '',
    logoUrl: '',
    brandColor: '#2563eb',
    crmWebhook: '',
    channels: [],
    inviteEmails: [],
  });

  function update(partial) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          slug: data.slug,
          logoUrl: data.logoUrl || `https://www.brandidentity.com/logo/${data.slug}.com`,
          brandColor: data.brandColor,
          crmWebhook: data.crmWebhook,
          channels: data.channels,
          inviteEmails: (data.inviteEmails || []).filter(Boolean),
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create workspace');
      }

      const { slug } = await res.json();
      router.push(`/${slug}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="https://www.brandidentity.com/logo/appchat.com" alt="AppChat" className="h-10 mx-auto mb-6" />
        </div>

        <StepIndicator current={step} />

        {error && (
          <div className="mb-4 p-3 bg-red-600/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {step === 0 && <OrgStep data={data} onChange={update} onNext={() => setStep(1)} />}
        {step === 1 && <BrandingStep data={data} onChange={update} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <ChannelsStep data={data} onChange={update} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <InviteStep data={data} onChange={update} onSubmit={handleSubmit} onBack={() => setStep(2)} loading={loading} />}
      </div>
    </div>
  );
}
