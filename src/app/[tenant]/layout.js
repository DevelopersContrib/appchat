import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth.js';
import { getTenantBySlug, requireMembership } from '@/lib/tenant.js';
import { findVnocDomain } from '@/lib/domains.js';
import { query } from '@/lib/db.js';
import Sidebar from '@/components/Sidebar.jsx';
import MemberList from '@/components/MemberList.jsx';
import { listDms } from '@/lib/presence.js';

export async function generateMetadata({ params }) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug).catch(() => null);
  return tenant ? { appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: tenant.name } } : {};
}

export default async function TenantLayout({ children, params }) {
  const { tenant: slug } = await params;

  if (slug === 'admin' || slug === 'api' || slug === 'login' || slug === 'onboard' || slug === 'room' || slug === 'about' || slug === 'contact' || slug === 'privacy' || slug === 'terms') {
    return children;
  }

  const tenant = await getTenantBySlug(slug);

  if (tenant) {
    const user = await getSession();
    if (!user) redirect('/login');

    let membership = null;
    try {
      membership = await requireMembership(slug, user.id);
    } catch {}

    // Rendered rather than redirected: on a private host like team.vnoc.com, "/" is this same page.
    if (!membership) {
      return (
        <div className="h-screen flex items-center justify-center bg-gray-950 text-gray-300 px-6">
          <div className="text-center max-w-sm">
            <h1 className="text-lg font-semibold mb-2">You're not a member of {tenant.name}</h1>
            <p className="text-sm text-gray-500 mb-6">Signed in as {user.email}. Ask an admin to add you, then sign in again.</p>
            <form action="/api/auth/logout" method="post">
              <button className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm">Sign out</button>
            </form>
          </div>
        </div>
      );
    }

    const channels = await query(
      `SELECT c.* FROM channels c
       JOIN channel_members cm ON cm.channel_id = c.id
       WHERE c.tenant_id = ? AND cm.user_id = ? AND c.is_dm = 0
       ORDER BY c.name`,
      [tenant.id, user.id]
    );
    const dms = await listDms(tenant.id, user.id);

    const tenantDomain = tenant.domain || `${slug}.com`;

    return (
      <>
        <link href={`https://brandidentity.com/font/${tenantDomain}`} rel="stylesheet" />
        <link href={`https://www.brandidentity.com/api/v1/brands/${tenantDomain}/css?format=typography`} rel="stylesheet" />
        <div className="h-dvh flex overflow-hidden">
          <Sidebar
            tenant={{ ...tenant, logo_url: `https://www.brandidentity.com/logo/${tenantDomain}` }}
            channels={channels}
            dms={JSON.parse(JSON.stringify(dms))}
            user={user}
            role={membership.role}
            currentSlug={slug}
          />
          <main className="flex-1 flex flex-col min-w-0 min-h-0" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {children}
          </main>
          <MemberList currentSlug={slug} currentUserId={user.id} />
        </div>
      </>
    );
  }

  const vnocDomain = await findVnocDomain(slug);
  if (vnocDomain) {
    return (
      <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
        {children}
      </div>
    );
  }

  redirect('/');
}
