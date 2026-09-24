import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth.js';
import { requireTenantAdmin } from '@/lib/tenant.js';
import { query } from '@/lib/db.js';
import WorkspaceSettings from '@/components/WorkspaceSettings.jsx';

export const metadata = { title: 'Workspace settings' };

export default async function SettingsPage({ params, searchParams }) {
  const { tenant: slug } = await params;
  const { tab } = await searchParams;
  const user = await getSession();
  if (!user) redirect('/login');
  const admin = await requireTenantAdmin(slug, user).catch(() => null);
  if (!admin) redirect(`/${slug}`);
  const channels = await query(
    'SELECT id, name FROM channels WHERE tenant_id = ? AND is_dm = 0 AND is_private = 0 AND archived_at IS NULL ORDER BY name',
    [admin.tenant_id]
  );
  return <WorkspaceSettings tenantSlug={slug} initialTab={tab || 'general'} channels={channels} myId={user.id} />;
}
