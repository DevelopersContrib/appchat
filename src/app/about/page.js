import Link from 'next/link';

export const metadata = {
  title: 'About — AppChat',
  description: 'AppChat is a white-label meeting platform with AI agents for modern teams. Built for sales, onboarding, and portfolio management.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/">
            <img src="https://www.brandidentity.com/logo/appchat.com" alt="AppChat" className="h-8" />
          </Link>
          <Link href="/login" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">
            Get Started
          </Link>
        </div>
      </header>

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-blue-400 text-sm font-medium uppercase tracking-wider mb-3">About Us</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-8">
            Communication infrastructure
            <br />
            <span className="text-gray-500">for the autonomous enterprise.</span>
          </h1>

          <div className="prose prose-invert max-w-none space-y-6 text-gray-300 leading-relaxed">
            <p className="text-lg">
              AppChat is a white-label communication platform that gives every organization
              their own branded meeting space — complete with chat, HD video, voice calls,
              and an AI agent that participates in every conversation.
            </p>

            <div className="grid md:grid-cols-2 gap-6 my-12">
              <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50">
                <div className="text-3xl font-bold text-blue-500 mb-1">6,000+</div>
                <div className="text-sm text-gray-400">Companies in our network</div>
              </div>
              <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50">
                <div className="text-3xl font-bold text-blue-500 mb-1">21,000+</div>
                <div className="text-sm text-gray-400">Domains under management</div>
              </div>
              <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50">
                <div className="text-3xl font-bold text-blue-500 mb-1">1M+</div>
                <div className="text-sm text-gray-400">Monthly visitors across portfolio</div>
              </div>
              <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50">
                <div className="text-3xl font-bold text-blue-500 mb-1">24/7</div>
                <div className="text-sm text-gray-400">AI agent availability</div>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mt-12 mb-4">Our Mission</h2>
            <p>
              We believe every business — from a single-domain venture to a Fortune 500 — deserves
              a professional, branded communication channel that works as hard as they do.
              No more juggling Zoom links, Slack threads, and CRM updates. AppChat unifies
              chat, meetings, and AI into one platform that represents your brand.
            </p>

            <h2 className="text-2xl font-bold text-white mt-12 mb-4">The Technology</h2>
            <p>
              AppChat is built on enterprise-grade infrastructure: LiveKit for ultra-low-latency
              video and voice, Daily.co for embedded collaboration rooms, and AI agents powered
              by large language models that understand your business context in real-time.
            </p>
            <p>
              Every tenant gets isolated data, custom branding, and their own subdomain.
              Your data stays yours — encrypted at rest and in transit, with role-based
              access controls and full audit logging.
            </p>

            <h2 className="text-2xl font-bold text-white mt-12 mb-4">Built by VentureOS</h2>
            <p>
              AppChat is part of the VentureOS ecosystem — an autonomous enterprise platform
              managing thousands of digital ventures, domain assets, and AI-powered services.
              We built AppChat because we needed it ourselves: a way to have professional,
              branded conversations with partners, sponsors, and VIPs across a massive portfolio.
            </p>
          </div>

          <div className="mt-16 p-8 rounded-2xl bg-gradient-to-r from-blue-950/50 to-indigo-950/50 border border-blue-500/20 text-center">
            <h3 className="text-xl font-bold mb-3">Ready to try AppChat?</h3>
            <p className="text-gray-400 text-sm mb-6">Deploy your branded meeting platform in under 5 minutes.</p>
            <Link href="/login" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition">
              Get Started Free
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-800/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-500">AppChat &mdash; Secure communication for modern teams.</span>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/about" className="hover:text-white transition">About</Link>
            <Link href="/contact" className="hover:text-white transition">Contact</Link>
            <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
