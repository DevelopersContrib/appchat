import './globals.css';

export const metadata = {
  title: 'AppChat — White-Label Meeting Platform with AI Agents',
  description: 'Secure chat, HD video calls, and AI agents for your organization. Deploy your branded meeting platform in minutes. Multi-tenant, white-label, CRM-integrated.',
  keywords: ['chat platform', 'video conferencing', 'AI meeting agent', 'white-label', 'multi-tenant', 'team communication'],
  openGraph: {
    title: 'AppChat — Your Meetings. Your AI Agent. Your Platform.',
    description: 'White-label chat, video, and voice with an AI agent that takes notes, answers questions, and follows up.',
    url: 'https://appchat.com',
    siteName: 'AppChat',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AppChat — White-Label Meeting Platform with AI Agents',
    description: 'Deploy your branded meeting platform in minutes.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://brandidentity.com/font/appchat.com" rel="stylesheet" />
        <link href="https://www.brandidentity.com/api/v1/brands/appchat.com/css?format=typography" rel="stylesheet" />
      </head>
      <body className="bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
