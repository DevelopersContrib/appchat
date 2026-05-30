import Link from 'next/link';

export const metadata = {
  title: 'Contact — AppChat',
  description: 'Get in touch with the AppChat team. Sales inquiries, support, and partnerships.',
};

export default function ContactPage() {
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
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-wider mb-3">Contact</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Get in touch</h1>
            <p className="text-gray-400 max-w-xl mx-auto">
              Questions about AppChat? Want a demo? Looking to partner? We&apos;d love to hear from you.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <h3 className="font-semibold mb-1">Sales</h3>
              <p className="text-sm text-gray-400">Enterprise plans and demos</p>
              <p className="text-sm text-blue-400 mt-2">sales@appchat.com</p>
            </div>

            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-1">Support</h3>
              <p className="text-sm text-gray-400">Technical help and billing</p>
              <p className="text-sm text-blue-400 mt-2">support@appchat.com</p>
            </div>

            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-1">Partnerships</h3>
              <p className="text-sm text-gray-400">Integrations and resellers</p>
              <p className="text-sm text-blue-400 mt-2">partners@appchat.com</p>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-900/50 border border-gray-800/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800/50">
              <h2 className="font-semibold">Send us a message</h2>
            </div>
            <div className="p-1">
              <iframe
                src="https://www.domaindirectory.com/servicepage/?domain=appchat.com"
                className="w-full border-0 rounded-xl bg-white"
                style={{ minHeight: '500px' }}
                title="Contact Form"
              />
            </div>
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
