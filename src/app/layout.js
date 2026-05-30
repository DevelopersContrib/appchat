import './globals.css';

export const metadata = {
  metadataBase: new URL('https://appchat.com'),
  title: { default: 'AppChat — White-Label Meeting Platform with AI Agents', template: '%s — AppChat' },
  description: 'Secure chat, HD video calls, and AI agents for your organization. Deploy your branded meeting platform in minutes. Multi-tenant, white-label, CRM-integrated.',
  keywords: ['chat platform', 'video conferencing', 'AI meeting agent', 'white-label', 'multi-tenant', 'team communication'],
  authors: [{ name: 'AppChat', url: 'https://appchat.com' }],
  creator: 'VentureOS',
  publisher: 'AppChat',
  openGraph: {
    title: 'AppChat — Your Meetings. Your AI Agent. Your Platform.',
    description: 'White-label chat, video, and voice with an AI agent that takes notes, answers questions, and follows up.',
    url: 'https://appchat.com',
    siteName: 'AppChat',
    type: 'website',
    locale: 'en_US',
    images: [{ url: 'https://www.brandidentity.com/logo/appchat.com', width: 512, height: 512, alt: 'AppChat' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AppChat — White-Label Meeting Platform with AI Agents',
    description: 'Deploy your branded meeting platform in minutes.',
    images: ['https://www.brandidentity.com/logo/appchat.com'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  verification: {},
  category: 'technology',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://brandidentity.com/font/appchat.com" rel="stylesheet" />
        <link href="https://www.brandidentity.com/api/v1/brands/appchat.com/css?format=typography" rel="stylesheet" />
      </head>
      <body className="bg-gray-950 text-gray-100 antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'AppChat',
              url: 'https://appchat.com',
              logo: 'https://www.brandidentity.com/logo/appchat.com',
              description: 'White-label meeting platform with AI agents. Chat, video, voice for modern teams.',
              applicationCategory: 'CommunicationApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'AggregateOffer',
                lowPrice: '0',
                highPrice: '29',
                priceCurrency: 'USD',
                offerCount: 3,
              },
              author: { '@type': 'Organization', name: 'VentureOS', url: 'https://ventureos.com' },
              provider: { '@type': 'Organization', name: 'AppChat', url: 'https://appchat.com' },
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
