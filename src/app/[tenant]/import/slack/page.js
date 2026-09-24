import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth.js';
import { requireTenantAdmin } from '@/lib/tenant.js';
import SlackImport from '@/components/SlackImport.jsx';

export const metadata = { title: 'Import from Slack' };

export default async function SlackImportPage({ params }) {
  const { tenant: slug } = await params;
  const user = await getSession();
  if (!user) redirect('/login');
  const admin = await requireTenantAdmin(slug, user).catch(() => null);
  if (!admin) redirect(`/${slug}`);
  return <SlackImport tenantSlug={slug} />;
}
