import { queryOne, query } from './db.js';

export async function getTenantBySlug(slug) {
  return queryOne('SELECT * FROM tenants WHERE slug = ?', [slug]);
}

export async function getTenantByDomain(domain) {
  return queryOne('SELECT * FROM tenants WHERE domain = ?', [domain]);
}

export async function getUserTenants(userId) {
  return query(
    `SELECT t.*, tm.role FROM tenants t
     JOIN tenant_members tm ON tm.tenant_id = t.id
     WHERE tm.user_id = ?
     ORDER BY t.name`,
    [userId]
  );
}

export async function requireMembership(tenantSlug, userId) {
  const row = await queryOne(
    `SELECT tm.*, t.id as tenant_id, t.slug, t.name as tenant_name, t.brand_color, t.logo_url
     FROM tenant_members tm
     JOIN tenants t ON t.id = tm.tenant_id
     WHERE t.slug = ? AND tm.user_id = ?`,
    [tenantSlug, userId]
  );
  if (!row) throw new Error('Not a member of this organization');
  return row;
}

export async function resolveTenant(request) {
  const host = request.headers.get('host') || '';
  const subdomain = host.split('.')[0];

  if (subdomain && subdomain !== 'appchat' && subdomain !== 'www' && subdomain !== 'localhost') {
    const tenant = await getTenantBySlug(subdomain);
    if (tenant) return tenant;
  }

  const tenant = await getTenantByDomain(host);
  if (tenant) return tenant;

  return null;
}
