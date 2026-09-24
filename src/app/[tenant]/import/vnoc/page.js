import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth.js';
import { requireTenantAdmin } from '@/lib/tenant.js';
import VnocTeamsImport from '@/components/VnocTeamsImport.jsx';

export const metadata = { title: 'Import VNOC teams' };

export default async function VnocTeamsPage({ params }) {
  const { tenant: slug } = await params;
  const user = await getSession();
  if (!user) redirect('/login');
  const admin = await requireTenantAdmin(slug, user).catch(() => null);
  if (!admin) redirect(`/${slug}`);
  return <VnocTeamsImport tenantSlug={slug} />;
}
