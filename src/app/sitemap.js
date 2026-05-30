import { query } from '@/lib/db.js';

export default async function sitemap() {
  const base = 'https://appchat.com';

  const staticPages = [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  let tenantPages = [];
  try {
    const tenants = await query('SELECT slug, created_at FROM tenants ORDER BY slug');
    tenantPages = tenants.map((t) => ({
      url: `${base}/${t.slug}`,
      lastModified: new Date(t.created_at),
      changeFrequency: 'weekly',
      priority: 0.7,
    }));
  } catch {}

  return [...staticPages, ...tenantPages];
}
