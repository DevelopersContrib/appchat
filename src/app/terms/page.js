import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — AppChat',
  description: 'AppChat terms of service. Rules and guidelines for using the platform.',
};

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-gray-500 text-sm mb-12">Last updated: May 30, 2026</p>

          <div className="space-y-8 text-gray-300 leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing or using AppChat (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
                If you are using the Service on behalf of an organization, you represent that you have the
                authority to bind that organization to these terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
              <p>
                AppChat provides a multi-tenant communication platform including text messaging, video
                conferencing, voice calls, AI-assisted meeting tools, and CRM integrations. The Service
                is provided on a subscription basis with usage-based billing for certain features.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. Accounts & Organizations</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>You must provide accurate and complete registration information.</li>
                <li>You are responsible for maintaining the security of your account credentials.</li>
                <li>Organization owners are responsible for managing team member access and permissions.</li>
                <li>One person may belong to multiple organizations with separate roles.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
              <p className="mb-3">You agree not to use AppChat to:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li>Violate any applicable laws or regulations.</li>
                <li>Transmit malware, spam, or harmful content.</li>
                <li>Impersonate others or misrepresent your affiliation.</li>
                <li>Attempt to gain unauthorized access to other accounts or systems.</li>
                <li>Interfere with the Service&apos;s infrastructure or other users&apos; experience.</li>
                <li>Use the platform for illegal surveillance or harassment.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. Billing & Usage</h2>
              <p className="mb-3">
                AppChat offers free and paid tiers. Usage-based charges apply to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-400">
                <li><strong className="text-gray-300">Room minutes:</strong> Video and voice call duration beyond the free tier allocation.</li>
                <li><strong className="text-gray-300">AI Agent usage:</strong> AI participation minutes in rooms.</li>
                <li><strong className="text-gray-300">Storage:</strong> File uploads and call recordings beyond the included quota.</li>
                <li><strong className="text-gray-300">Custom domains:</strong> White-label subdomain or custom domain configuration.</li>
              </ul>
              <p className="mt-3">
                Usage is tracked per organization and billed monthly. You will receive a notification
                when approaching tier limits. Overages are billed at published rates.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Content Ownership</h2>
              <p>
                You retain all rights to content you create or upload to AppChat. By using the Service,
                you grant AppChat a limited license to store, process, and transmit your content as
                necessary to provide the Service. We do not claim ownership of your data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. AI Agent Disclaimer</h2>
              <p>
                The AI Agent provides automated assistance including note-taking, summarization, and
                question answering. AI-generated content may contain inaccuracies. You should review
                all AI summaries before relying on them for business decisions. AppChat is not liable
                for actions taken based on AI-generated content.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Service Availability</h2>
              <p>
                We target 99.9% uptime but do not guarantee uninterrupted service. Planned maintenance
                windows will be communicated in advance. We are not liable for downtime caused by
                third-party services, force majeure, or circumstances beyond our reasonable control.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Termination</h2>
              <p>
                Either party may terminate the agreement at any time. Upon termination, your data
                will be available for export for 30 days, after which it will be permanently deleted.
                We may suspend or terminate accounts that violate these terms without prior notice.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">10. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, AppChat&apos;s total liability is limited to the
                amount you paid for the Service in the 12 months preceding the claim. We are not
                liable for indirect, incidental, or consequential damages.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">11. Changes to Terms</h2>
              <p>
                We may update these terms from time to time. Material changes will be communicated
                via email or in-app notification at least 30 days before they take effect. Continued
                use after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">12. Contact</h2>
              <p>
                Questions about these terms? Contact us at{' '}
                <a href="mailto:legal@appchat.com" className="text-blue-400 hover:text-blue-300">legal@appchat.com</a>{' '}
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
            <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
            <Link href="/terms" className="text-white">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
