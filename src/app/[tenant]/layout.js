import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth.js';
import { getTenantBySlug, requireMembership } from '@/lib/tenant.js';
import { findVnocDomain } from '@/lib/domains.js';
import { query } from '@/lib/db.js';
import Sidebar from '@/components/Sidebar.jsx';

export default async function TenantLayout({ children, params }) {
  const { tenant: slug } = await params;

  if (slug === 'admin' || slug === 'api' || slug === 'login' || slug === 'onboard' || slug === 'room' || slug === 'about' || slug === 'contact' || slug === 'privacy' || slug === 'terms') {
    return children;
  }

  const tenant = await getTenantBySlug(slug);

  if (tenant) {
    const user = await getSession();
    if (!user) redirect('/login');

    let membership;
    try {
      membership = await requireMembership(slug, user.id);
    } catch {
      redirect('/');
    }

    const channels = await query(
      `SELECT c.* FROM channels c
       JOIN channel_members cm ON cm.channel_id = c.id
       WHERE c.tenant_id = ? AND cm.user_id = ?
       ORDER BY c.name`,
      [tenant.id, user.id]
    );

    return (
      <div className="h-screen flex">
        <Sidebar
          tenant={tenant}
          channels={channels}
          user={user}
          role={membership.role}
          currentSlug={slug}
        />
        <main className="flex-1 flex flex-col min-w-0">
          {children}
        </main>
      </div>
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
