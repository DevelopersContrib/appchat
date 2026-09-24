import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth.js';
import { requireTenantAdmin } from '@/lib/tenant.js';
import DiscordImport from '@/components/DiscordImport.jsx';

export const metadata = { title: 'Import from Discord' };

export default async function DiscordImportPage({ params }) {
  const { tenant: slug } = await params;
  const user = await getSession();
  if (!user) redirect('/login');
  const admin = await requireTenantAdmin(slug, user).catch(() => null);
  if (!admin) redirect(`/${slug}`);
  return <DiscordImport tenantSlug={slug} />;
}
