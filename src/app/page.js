import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-8 py-5 border-b border-gray-800">
        <div className="text-xl font-bold tracking-tight">
          <span className="text-blue-500">App</span>Chat
        </div>
        <Link
          href="/login"
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition"
        >
          Sign In
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
          Professional meetings,
          <br />
          <span className="text-blue-500">powered by AI</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mb-10">
          Secure chat, HD video calls, and an AI agent that joins your
          conversations — takes notes, answers questions, and follows up
          automatically.
        </p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition"
          >
            Get Started
          </Link>
          <a
            href="#features"
            className="px-8 py-3 border border-gray-700 hover:border-gray-500 rounded-lg font-medium transition"
          >
            Learn More
          </a>
        </div>

        <section id="features" className="mt-32 grid md:grid-cols-3 gap-8 max-w-4xl w-full text-left">
          <div className="p-6 rounded-xl bg-gray-900 border border-gray-800">
            <div className="text-2xl mb-3">💬</div>
            <h3 className="font-semibold mb-2">Team Chat</h3>
            <p className="text-sm text-gray-400">
              Channels, DMs, threads, and file sharing. Organized by topic, searchable forever.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-gray-900 border border-gray-800">
            <div className="text-2xl mb-3">📹</div>
            <h3 className="font-semibold mb-2">Video & Voice</h3>
            <p className="text-sm text-gray-400">
              One click to escalate any chat to a call. Screen share, recording, and guest invite links.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-gray-900 border border-gray-800">
            <div className="text-2xl mb-3">🤖</div>
            <h3 className="font-semibold mb-2">AI Agent</h3>
            <p className="text-sm text-gray-400">
              An AI participant that takes notes, answers questions from your data, and posts summaries after every call.
            </p>
          </div>
        </section>
      </main>

      <footer className="px-8 py-6 text-center text-sm text-gray-600 border-t border-gray-800">
        AppChat &mdash; Secure communication for modern teams.
      </footer>
    </div>
  );
}
