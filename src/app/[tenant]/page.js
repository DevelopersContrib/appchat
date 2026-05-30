import Link from 'next/link';
import { getTenantBySlug } from '@/lib/tenant.js';
import { findVnocDomain } from '@/lib/domains.js';

export async function generateMetadata({ params }) {
  const { tenant: slug } = await params;

  const tenant = await getTenantBySlug(slug);
  if (tenant) {
    const domain = tenant.domain || `${slug}.com`;
    return {
      title: `${tenant.name} — AppChat`,
      description: `Join ${tenant.name} on AppChat. Secure chat, video calls, and AI-powered meetings.`,
      openGraph: {
        title: `${tenant.name} — AppChat`,
        description: `Chat, video, and voice with ${tenant.name} on AppChat.`,
        url: `https://appchat.com/${slug}`,
        images: [{ url: `https://www.brandidentity.com/logo/${domain}`, alt: tenant.name }],
      },
      twitter: {
        card: 'summary',
        title: `${tenant.name} — AppChat`,
        images: [`https://www.brandidentity.com/logo/${domain}`],
      },
      alternates: { canonical: `https://appchat.com/${slug}` },
    };
  }

  const domain = await findVnocDomain(slug);
  if (domain) {
    return {
      title: `${domain.domain_name} — AppChat`,
      description: domain.description || `Join the ${domain.domain_name} community on AppChat. Chat, video calls, and AI-powered meetings.`,
      keywords: [domain.domain_name, domain.category_name, 'chat', 'video call', 'meeting'].filter(Boolean),
      openGraph: {
        title: `${domain.domain_name} — Chat & Video`,
        description: domain.title || `Connect with ${domain.domain_name} on AppChat.`,
        url: `https://appchat.com/${slug}`,
        images: [{ url: `https://www.brandidentity.com/logo/${domain.domain_name}`, alt: domain.domain_name }],
      },
      twitter: {
        card: 'summary',
        title: `${domain.domain_name} — AppChat`,
        images: [`https://www.brandidentity.com/logo/${domain.domain_name}`],
      },
      alternates: { canonical: `https://appchat.com/${slug}` },
    };
  }

  return { title: 'AppChat' };
}

export default async function TenantPage({ params }) {
  const { tenant: slug } = await params;

  const tenant = await getTenantBySlug(slug);
  if (tenant) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <img src={`https://www.brandidentity.com/logo/${tenant.slug}.com`} alt={tenant.name} className="h-12 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-300 mb-2">
            Welcome to {tenant.name}
          </h2>
          <p className="text-sm">Select a channel from the sidebar to start chatting.</p>
        </div>
      </div>
    );
  }

  const domain = await findVnocDomain(slug);
  if (!domain) return null;

  const domainName = domain.domain_name;
  const logoUrl = `https://www.brandidentity.com/logo/${domainName}`;

  return (
    <>
      <head>
        <link href={`https://brandidentity.com/font/${domainName}`} rel="stylesheet" />
        <link href={`https://www.brandidentity.com/api/v1/brands/${domainName}/css?format=typography`} rel="stylesheet" />
      </head>

      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt={domainName} className="h-8 rounded" />
          <div>
            <h1 className="font-semibold">{domainName}</h1>
            {domain.category_name && (
              <span className="text-xs text-gray-500">{domain.category_name}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 bg-[#d63031] hover:bg-[#c0392b] text-white rounded-lg text-sm font-medium transition">
            Join Chat
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <img src={logoUrl} alt={domainName} className="h-20 mx-auto mb-6 rounded-xl" />
          <h2 className="text-3xl font-bold mb-3">{domain.title || domainName}</h2>
          {domain.description && (
            <p className="text-gray-400 text-sm mb-6 leading-relaxed line-clamp-3">{domain.description}</p>
          )}

          <div className="flex items-center justify-center gap-4 mb-8">
            {domain.category_name && (
              <span className="px-3 py-1 bg-[#fdcb6e]/10 text-[#fdcb6e] text-xs rounded-full">{domain.category_name}</span>
            )}
            <span className="px-3 py-1 bg-gray-800 text-gray-400 text-xs rounded-full">{domain.account_type}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/login"
              className="px-6 py-3 bg-[#d63031] hover:bg-[#c0392b] text-white rounded-xl font-medium transition text-sm"
            >
              Start Chat Room
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 bg-[#00b894] hover:bg-[#00a381] text-white rounded-xl font-medium transition text-sm"
            >
              Video Call
            </Link>
          </div>

          <p className="text-xs text-gray-600 mt-6">
            Powered by <Link href="/" className="text-gray-400 hover:text-white">AppChat</Link>
          </p>
        </div>
      </main>
    </>
  );
}
