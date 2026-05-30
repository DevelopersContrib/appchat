import Link from 'next/link';

export const metadata = {
  title: 'AppChat — White-Label Meeting Platform with AI Agents',
  description: 'Secure chat, HD video calls, and AI agents for your organization. Deploy your branded meeting platform in minutes. Multi-tenant, white-label, CRM-integrated.',
  keywords: ['chat platform', 'video conferencing', 'AI meeting agent', 'white-label', 'multi-tenant', 'team communication', 'LiveKit', 'Daily.co'],
  openGraph: {
    title: 'AppChat — Your Meetings. Your AI Agent. Your Platform.',
    description: 'White-label chat, video, and voice with an AI agent that takes notes, answers questions, and follows up. Deploy under your brand in minutes.',
    url: 'https://appchat.com',
    siteName: 'AppChat',
    type: 'website',
    images: [{ url: 'https://www.brandidentity.com/logo/appchat.com', width: 512, height: 512, alt: 'AppChat Logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AppChat — White-Label Meeting Platform with AI Agents',
    description: 'Deploy your branded meeting platform in minutes. Chat, video, voice + AI agent.',
    images: ['https://www.brandidentity.com/logo/appchat.com'],
  },
  alternates: { canonical: 'https://appchat.com' },
};

function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <img src="https://www.brandidentity.com/logo/appchat.com" alt="AppChat" className="h-8" />
        <nav className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#how-it-works" className="hover:text-white transition">How It Works</a>
          <a href="#use-cases" className="hover:text-white transition">Use Cases</a>
          <a href="#ecosystem" className="hover:text-white transition">Ecosystem</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition">
            Log In
          </Link>
          <Link
            href="/login"
            className="px-5 py-2 bg-[#d63031] hover:bg-[#c0392b] text-white rounded-lg text-sm font-medium transition"
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#d63031]/10 border border-[#d63031]/20 rounded-full text-[#d63031] text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 bg-[#d63031] rounded-full animate-pulse" />
          Now with AI Agent &mdash; joins your meetings automatically
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
          Your meetings.
          <br />
          <span className="bg-gradient-to-r from-[#d63031] via-[#e17055] to-[#fdcb6e] bg-clip-text text-transparent">
            Your AI agent.
          </span>
          <br />
          Your platform.
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          White-label chat, video, and voice — with an AI agent that takes notes,
          answers questions, and follows up. Deploy under your brand in minutes.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 bg-[#d63031] hover:bg-[#c0392b] text-white rounded-xl font-medium transition text-center shadow-lg shadow-[#d63031]/20"
          >
            Start Free Trial
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-8 py-3.5 border border-gray-700 hover:border-gray-500 rounded-xl font-medium transition text-center flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
            </svg>
            See How It Works
          </a>
        </div>

        <div className="relative max-w-5xl mx-auto">
          <div className="absolute -inset-4 bg-gradient-to-r from-[#d63031]/20 via-[#fdcb6e]/10 to-[#00b894]/20 rounded-2xl blur-xl" />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#d63031]" />
                <div className="w-3 h-3 rounded-full bg-[#fdcb6e]" />
                <div className="w-3 h-3 rounded-full bg-[#00b894]" />
              </div>
              <div className="flex-1 text-center text-xs text-gray-500">vnoc.appchat.com</div>
            </div>
            <div className="flex h-[400px]">
              <div className="w-56 bg-gray-900/80 border-r border-gray-800 p-3">
                <div className="text-xs text-gray-500 uppercase tracking-wider px-2 mb-2">Channels</div>
                <div className="space-y-0.5">
                  <div className="px-3 py-1.5 bg-[#d63031]/20 text-[#d63031] rounded text-sm"># general</div>
                  <div className="px-3 py-1.5 text-gray-500 rounded text-sm"># partnerships</div>
                  <div className="px-3 py-1.5 text-gray-500 rounded text-sm"># deal-room</div>
                  <div className="px-3 py-1.5 text-gray-500 rounded text-sm"># onboarding</div>
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wider px-2 mt-4 mb-2">Direct</div>
                <div className="space-y-0.5">
                  <div className="px-3 py-1.5 text-gray-500 rounded text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#00b894] rounded-full" /> Jason C.
                  </div>
                  <div className="px-3 py-1.5 text-gray-500 rounded text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full" /> Sarah M.
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                  <div className="font-medium text-sm"># general</div>
                  <div className="px-2.5 py-1 bg-[#00b894]/20 text-[#00b894] rounded-lg text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#00b894] rounded-full animate-pulse" /> Live
                  </div>
                </div>
                <div className="flex-1 px-5 py-4 space-y-4 overflow-hidden">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0">C</div>
                    <div>
                      <div className="flex items-baseline gap-2"><span className="font-medium text-sm">Cathy</span><span className="text-xs text-gray-600">10:32 AM</span></div>
                      <p className="text-sm text-gray-400">Jason confirmed for the 2pm call. He wants to see the portfolio dashboard live.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#d63031] flex items-center justify-center text-xs font-bold flex-shrink-0">AI</div>
                    <div>
                      <div className="flex items-baseline gap-2"><span className="font-medium text-sm text-[#fdcb6e]">AppChat Agent</span><span className="text-xs text-gray-600">10:32 AM</span></div>
                      <p className="text-sm text-gray-400">Got it. I&apos;ll join the 2pm room, pull Jason&apos;s FullContact profile, and have portfolio stats ready. Want me to record the call?</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#00b894] flex items-center justify-center text-xs font-bold flex-shrink-0">L</div>
                    <div>
                      <div className="flex items-baseline gap-2"><span className="font-medium text-sm">Lucille</span><span className="text-xs text-gray-600">10:34 AM</span></div>
                      <p className="text-sm text-gray-400">Yes, record + summary. Tag the CRM after.</p>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-gray-800">
                  <div className="bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-500">Type a message...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="py-16 px-6 border-y border-gray-800/50">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {[
          ['99.9%', 'Uptime SLA'],
          ['E2E Encrypted', 'All messages'],
          ['< 200ms', 'Message latency'],
          ['SOC 2', 'Compliant'],
        ].map(([value, label]) => (
          <div key={label}>
            <div className="text-2xl md:text-3xl font-bold text-white mb-1">{value}</div>
            <div className="text-sm text-gray-500">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { icon: '💬', title: 'Persistent Chat', desc: 'Channels, DMs, threads, and file sharing. Messages are stored, searchable, and never lost — even when you\'re offline.' },
    { icon: '📹', title: 'HD Video & Voice', desc: 'One-click escalation from chat to call. Screen sharing, recording, and guest invite links — no downloads required.' },
    { icon: '🤖', title: 'AI Agent', desc: 'An AI participant joins your rooms — takes live notes, answers questions from your data, and posts a summary to your CRM when the call ends.' },
    { icon: '🏢', title: 'Multi-Tenant', desc: 'Each organization gets their own workspace — branded with their logo and colors. Subdomain routing or custom domains.' },
    { icon: '🔗', title: 'CRM Integration', desc: 'Webhook into any CRM. Call summaries, contact profiles, and engagement data flow directly into your pipeline.' },
    { icon: '🔒', title: 'Enterprise Security', desc: 'End-to-end encryption, role-based access, audit logs, and SSO. Your data never leaves your infrastructure.' },
  ];

  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#d63031] text-sm font-medium uppercase tracking-wider mb-3">Features</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to close deals faster</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Chat, video, AI, and CRM — unified in one platform your team and prospects actually want to use.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="group p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50 hover:border-[#d63031]/30 transition-all duration-300">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { num: '01', title: 'Send a branded link', desc: 'Your team sends prospects a link like vnoc.appchat.com/room/jason — branded with your logo and colors.' },
    { num: '02', title: 'Prospect joins instantly', desc: 'No downloads, no sign-ups. They click and land in a professional room with chat, voice, or video — their choice.' },
    { num: '03', title: 'AI agent participates', desc: 'The agent takes notes, pulls prospect data in real-time, answers technical questions, and keeps the conversation focused.' },
    { num: '04', title: 'Auto-summary to CRM', desc: 'When the call ends, a structured summary with action items flows directly into your CRM. Nothing falls through the cracks.' },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6 bg-gray-900/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#fdcb6e] text-sm font-medium uppercase tracking-wider mb-3">How It Works</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">From first contact to closed deal</h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Four steps. Zero friction. Your prospects never download an app or create an account.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-5 p-6 rounded-2xl border border-gray-800/50 bg-gray-950/50">
              <div className="text-3xl font-bold text-[#d63031]/30 flex-shrink-0">{s.num}</div>
              <div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const cases = [
    { title: 'Sales & Outreach', desc: 'Send branded meeting links to VIPs. Your AI agent pulls their company data, listens to the call, and logs everything to your CRM pipeline.', tag: 'Revenue', color: '#d63031' },
    { title: 'Client Onboarding', desc: 'Walk new clients through setup with screen sharing and real-time chat. The agent answers FAQs so your team can focus on the relationship.', tag: 'Success', color: '#00b894' },
    { title: 'Portfolio Management', desc: 'Manage hundreds of brands from one platform. Each gets their own tenant with dedicated channels, team members, and meeting history.', tag: 'Scale', color: '#fdcb6e' },
  ];

  return (
    <section id="use-cases" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#00b894] text-sm font-medium uppercase tracking-wider mb-3">Use Cases</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for teams that move fast</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {cases.map((c) => (
            <div key={c.title} className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50 hover:border-gray-700 transition flex flex-col">
              <span
                className="inline-block px-3 py-1 text-xs font-medium rounded-full w-fit mb-4"
                style={{ backgroundColor: c.color + '15', color: c.color }}
              >
                {c.tag}
              </span>
              <h3 className="font-semibold text-lg mb-3">{c.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed flex-1">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Ecosystem() {
  const platforms = [
    { name: 'VNOC', domain: 'vnoc.com', desc: 'The operating system for digital ventures. Manage domains, deploy landers, and orchestrate your entire portfolio from one dashboard.', tag: 'Operations Hub' },
    { name: 'GrowAgent', domain: 'growagent.com', desc: 'AI-powered CRM and outreach platform. Automate prospecting, track engagement pipelines, and close deals with intelligent follow-ups.', tag: 'CRM & Outreach' },
    { name: 'VentureOS', domain: 'ventureos.com', desc: 'The autonomous enterprise engine. 6,000+ companies, 21,000 domains, and a million monthly visitors — managed by AI agents.', tag: 'Enterprise Platform' },
    { name: 'AgentDAO', domain: 'agentdao.com', desc: 'Decentralized agent marketplace. Deploy, share, and monetize AI agents across the VentureOS network.', tag: 'Agent Network' },
  ];

  return (
    <section id="ecosystem" className="py-24 px-6 bg-gray-900/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#fdcb6e] text-sm font-medium uppercase tracking-wider mb-3">Ecosystem</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Powered by the VentureOS stack</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            AppChat is one piece of a fully integrated autonomous enterprise platform.
            Every tool connects. Every agent collaborates.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {platforms.map((p) => (
            <a
              key={p.domain}
              href={`https://${p.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-5 p-6 rounded-2xl bg-gray-950/50 border border-gray-800/50 hover:border-[#fdcb6e]/30 transition-all duration-300"
            >
              <div className="flex-shrink-0">
                <img
                  src={`https://www.brandidentity.com/logo/${p.domain}`}
                  alt={p.name}
                  className="w-14 h-14 rounded-xl object-contain bg-gray-900 p-2 border border-gray-800 group-hover:border-[#fdcb6e]/30 transition"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{p.name}</h3>
                  <span className="px-2 py-0.5 bg-[#fdcb6e]/10 text-[#fdcb6e] text-[10px] font-medium rounded-full">
                    {p.tag}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{p.domain}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{p.desc}</p>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            AppChat connects natively with every platform in the stack &mdash;
            <span className="text-gray-400"> CRM data from GrowAgent, domain assets from VNOC, agent capabilities from AgentDAO.</span>
          </p>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: 'Starter', price: 'Free', period: '', desc: 'For small teams getting started.',
      features: ['Up to 5 team members', '3 channels', '100 messages/day', 'Daily.co video rooms', 'Community support'],
      cta: 'Start Free', highlight: false,
    },
    {
      name: 'Professional', price: '$29', period: '/seat/mo', desc: 'For growing teams that need AI.',
      features: ['Unlimited team members', 'Unlimited channels', 'Unlimited messages', 'LiveKit HD video + AI agent', 'CRM integration', 'Custom branding', 'Priority support'],
      cta: 'Start Trial', highlight: true,
    },
    {
      name: 'Enterprise', price: 'Custom', period: '', desc: 'For organizations at scale.',
      features: ['Everything in Professional', 'Custom domain (chat.yourco.com)', 'SSO / SAML', 'Dedicated infrastructure', 'SLA guarantee', 'White-label resale rights', 'Onboarding concierge'],
      cta: 'Contact Sales', highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#d63031] text-sm font-medium uppercase tracking-wider mb-3">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-gray-400">Start free. Upgrade when you need AI and custom branding. Billing via <a href="https://paydirect.com" target="_blank" rel="noopener noreferrer" className="text-[#fdcb6e] hover:text-[#ffeaa7]">PayDirect</a>.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`p-6 rounded-2xl border flex flex-col ${
                p.highlight
                  ? 'bg-gradient-to-b from-[#d63031]/10 to-gray-950 border-[#d63031]/30 ring-1 ring-[#d63031]/20'
                  : 'bg-gray-950 border-gray-800/50'
              }`}
            >
              {p.highlight && (
                <span className="inline-block px-3 py-1 bg-[#d63031] text-white text-xs font-medium rounded-full w-fit mb-3">
                  Most Popular
                </span>
              )}
              <h3 className="font-semibold text-lg">{p.name}</h3>
              <div className="mt-3 mb-1">
                <span className="text-4xl font-bold">{p.price}</span>
                {p.period && <span className="text-gray-500 text-sm">{p.period}</span>}
              </div>
              <p className="text-sm text-gray-500 mb-6">{p.desc}</p>

              <ul className="space-y-2.5 mb-8 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-[#00b894] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className={`w-full py-3 rounded-xl text-sm font-medium text-center transition ${
                  p.highlight
                    ? 'bg-[#d63031] hover:bg-[#c0392b] text-white'
                    : 'border border-gray-700 hover:border-gray-500'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PublicRooms() {
  return (
    <section className="py-24 px-6 bg-gray-900/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[#00b894] text-sm font-medium uppercase tracking-wider mb-3">Live Now</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Public rooms</h2>
          <p className="text-gray-400">Join an open room or start your own.</p>
        </div>

        <div id="public-rooms-grid" className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-2xl bg-gray-900/50 border border-gray-800/50 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gray-800" />
                <div className="h-4 w-24 bg-gray-800 rounded" />
              </div>
              <div className="h-3 w-32 bg-gray-800 rounded mb-2" />
              <div className="h-3 w-20 bg-gray-800 rounded" />
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 border border-gray-700 hover:border-gray-500 rounded-xl text-sm font-medium transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create a Room
          </Link>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24 px-6 bg-gradient-to-br from-[#d63031] to-[#c0392b]">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to upgrade your meetings?
        </h2>
        <p className="text-white/70 mb-8 max-w-xl mx-auto">
          Deploy your branded meeting platform in under 5 minutes. No credit card required.
        </p>
        <Link
          href="/login"
          className="inline-block px-10 py-4 bg-white text-[#d63031] hover:bg-gray-100 rounded-xl font-medium transition text-lg shadow-xl"
        >
          Get Started Free
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-800/50 py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-5 gap-8 mb-12">
          <div>
            <img src="https://www.brandidentity.com/logo/appchat.com" alt="AppChat" className="h-7 mb-4" />
            <p className="text-sm text-gray-500 leading-relaxed">
              White-label meeting platform with AI agents for modern teams.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#features" className="hover:text-white transition">Features</a></li>
              <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
              <li><a href="#use-cases" className="hover:text-white transition">Use Cases</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition">How It Works</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/about" className="hover:text-white transition">About</Link></li>
              <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
              <li><a href="https://ventureos.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">VentureOS</a></li>
              <li><a href="https://paydirect.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">PayDirect Billing</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">Ecosystem</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="https://vnoc.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">VNOC</a></li>
              <li><a href="https://growagent.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">GrowAgent</a></li>
              <li><a href="https://agentdao.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">AgentDAO</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              <li><Link href="/contact" className="hover:text-white transition">Security</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs text-gray-600">&copy; {new Date().getFullYear()} AppChat. All rights reserved.</span>
          <span className="text-xs text-gray-600">Part of the <a href="https://vnoc.com" className="text-gray-500 hover:text-white transition">VentureOS</a> ecosystem.</span>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Nav />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <UseCases />
      <Ecosystem />
      <Pricing />
      <PublicRooms />
      <CTA />
      <Footer />
    </div>
  );
}
