import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — AppChat',
  description: 'AppChat privacy policy. How we collect, use, and protect your data.',
};

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm mb-12">Last updated: May 30, 2026</p>

          <div className="space-y-8 text-gray-300 leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
              <p className="mb-3">When you use AppChat, we collect the following types of information:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li><strong className="text-gray-300">Account Information:</strong> Email address, display name, and avatar when you create an account.</li>
                <li><strong className="text-gray-300">Organization Data:</strong> Organization name, branding preferences, and team member information.</li>
                <li><strong className="text-gray-300">Communication Data:</strong> Messages, files, and call recordings created within your workspace.</li>
                <li><strong className="text-gray-300">Usage Data:</strong> Room participation, message counts, and feature usage for billing and analytics.</li>
                <li><strong className="text-gray-300">Technical Data:</strong> IP address, browser type, and device information for security and performance.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>To provide, maintain, and improve AppChat services.</li>
                <li>To process transactions and send billing notifications.</li>
                <li>To communicate with you about updates, security alerts, and support.</li>
                <li>To enforce our Terms of Service and protect against fraud.</li>
                <li>To generate aggregated, anonymized analytics to improve the platform.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. Data Storage & Security</h2>
              <p>
                All data is stored on encrypted infrastructure hosted in AWS (US-West-2). Messages and files
                are encrypted at rest using AES-256. All connections use TLS 1.3. We implement
                role-based access controls and maintain audit logs for all administrative actions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Data Sharing</h2>
              <p className="mb-3">We do not sell your personal data. We share information only in these circumstances:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>With your organization&apos;s administrators, as part of their workspace.</li>
                <li>With service providers (LiveKit, AWS) necessary to deliver the service.</li>
                <li>When required by law, subpoena, or valid legal process.</li>
                <li>With your explicit consent.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. AI Agent & Data Processing</h2>
              <p>
                When the AI Agent is enabled in a room, conversation content is processed in real-time
                to generate summaries and responses. AI-processed data is not used to train models.
                Summaries are stored within your organization&apos;s workspace and are subject to the
                same access controls as other messages.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
              <p>
                Messages and files are retained for the duration of your subscription. Upon account
                deletion, all associated data is permanently removed within 30 days. Call recordings
                are retained for 90 days unless configured otherwise by your organization administrator.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. Your Rights</h2>
              <p className="mb-3">You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>Access and export your personal data.</li>
                <li>Correct inaccurate information.</li>
                <li>Delete your account and associated data.</li>
                <li>Opt out of non-essential communications.</li>
                <li>Request information about data processing activities.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Cookies</h2>
              <p>
                AppChat uses essential cookies for authentication and session management.
                We do not use tracking cookies or third-party advertising cookies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Contact</h2>
              <p>
                For privacy-related inquiries, contact us at{' '}
                <a href="mailto:privacy@appchat.com" className="text-blue-400 hover:text-blue-300">privacy@appchat.com</a>{' '}
                or visit our <Link href="/contact" className="text-blue-400 hover:text-blue-300">contact page</Link>.
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-800/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-500">AppChat &mdash; Secure communication for modern teams.</span>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/about" className="hover:text-white transition">About</Link>
            <Link href="/contact" className="hover:text-white transition">Contact</Link>
            <Link href="/privacy" className="text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
