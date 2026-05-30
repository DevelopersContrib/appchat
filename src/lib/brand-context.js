import { query, queryOne, insert } from './db.js';
import { unfurlUrl } from './unfurl.js';
import crypto from 'crypto';

export async function getBrandContext(tenantId, tenantSlug) {
  const tenant = await queryOne('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  if (!tenant) return null;

  const domain = tenant.domain || `${tenantSlug}.com`;

  const [knowledge, websites, brandApi] = await Promise.all([
    query('SELECT source_type, title, content FROM brand_knowledge WHERE tenant_id = ? ORDER BY last_synced_at DESC LIMIT 50', [tenantId]),
    query('SELECT url, label FROM tenant_websites WHERE tenant_id = ?', [tenantId]),
    fetchBrandIdentity(domain).catch(() => null),
  ]);

  const sections = [];

  sections.push(`## Brand: ${tenant.name}`);
  sections.push(`Domain: ${domain}`);
  if (tenant.brand_color) sections.push(`Brand Color: ${tenant.brand_color}`);

  if (brandApi) {
    sections.push('\n## Brand Identity');
    if (brandApi.tagline) sections.push(`Tagline: ${brandApi.tagline}`);
    if (brandApi.description) sections.push(`Description: ${brandApi.description}`);
    if (brandApi.industry) sections.push(`Industry: ${brandApi.industry}`);
    if (brandApi.values?.length) sections.push(`Values: ${brandApi.values.join(', ')}`);
    if (brandApi.tone) sections.push(`Tone: ${brandApi.tone}`);
    if (brandApi.fonts?.length) sections.push(`Fonts: ${brandApi.fonts.join(', ')}`);
  }

  const bySource = {};
  knowledge.forEach(k => {
    if (!bySource[k.source_type]) bySource[k.source_type] = [];
    bySource[k.source_type].push(k);
  });

  if (bySource.gdrive?.length) {
    sections.push('\n## Google Drive Documents');
    bySource.gdrive.forEach(doc => {
      sections.push(`\n### ${doc.title}`);
      sections.push(doc.content.slice(0, 2000));
    });
  }

  if (bySource.website?.length) {
    sections.push('\n## Website Content');
    bySource.website.forEach(page => {
      sections.push(`\n### ${page.title}`);
      sections.push(page.content.slice(0, 2000));
    });
  }

  if (bySource.manual?.length) {
    sections.push('\n## Additional Context');
    bySource.manual.forEach(m => {
      sections.push(`\n### ${m.title}`);
      sections.push(m.content);
    });
  }

  if (websites.length) {
    sections.push('\n## Brand Websites');
    websites.forEach(w => sections.push(`- ${w.label || w.url}: ${w.url}`));
  }

  return {
    tenant: { id: tenant.id, name: tenant.name, slug: tenantSlug, domain, brandColor: tenant.brand_color },
    context: sections.join('\n'),
    knowledgeCount: knowledge.length,
    websiteCount: websites.length,
  };
}

export async function indexWebsite(tenantId, url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      headers: { 'User-Agent': 'AppChat Bot/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || url;
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const text = bodyMatch
      ? bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    const content = text.slice(0, 10000);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    const existing = await queryOne(
      'SELECT id, content_hash FROM brand_knowledge WHERE tenant_id = ? AND source_type = ? AND source_url = ?',
      [tenantId, 'website', url]
    );

    if (existing) {
      if (existing.content_hash !== hash) {
        await query(
          'UPDATE brand_knowledge SET title = ?, content = ?, content_hash = ?, last_synced_at = NOW() WHERE id = ?',
          [title, content, hash, existing.id]
        );
      }
    } else {
      await insert(
        'INSERT INTO brand_knowledge (tenant_id, source_type, source_url, title, content, content_hash) VALUES (?, ?, ?, ?, ?, ?)',
        [tenantId, 'website', url, title, content, hash]
      );
    }

    await query(
      'UPDATE tenant_websites SET status = ?, last_crawled_at = NOW() WHERE tenant_id = ? AND url = ?',
      ['crawled', tenantId, url]
    );

    return { title, contentLength: content.length };
  } catch (err) {
    await query(
      'UPDATE tenant_websites SET status = ? WHERE tenant_id = ? AND url = ?',
      ['error', tenantId, url]
    );
    throw err;
  }
}

export async function indexDriveDoc(tenantId, accessToken, fileId, fileName) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let content;
  if (res.ok) {
    content = await res.text();
  } else {
    const alt = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    content = alt.ok ? await alt.text() : '';
  }

  content = content.slice(0, 10000);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const sourceUrl = `https://docs.google.com/open?id=${fileId}`;

  const existing = await queryOne(
    'SELECT id, content_hash FROM brand_knowledge WHERE tenant_id = ? AND source_type = ? AND source_url = ?',
    [tenantId, 'gdrive', sourceUrl]
  );

  if (existing) {
    if (existing.content_hash !== hash) {
      await query(
        'UPDATE brand_knowledge SET title = ?, content = ?, content_hash = ?, last_synced_at = NOW() WHERE id = ?',
        [fileName, content, hash, existing.id]
      );
    }
  } else {
    await insert(
      'INSERT INTO brand_knowledge (tenant_id, source_type, source_url, title, content, content_hash) VALUES (?, ?, ?, ?, ?, ?)',
      [tenantId, 'gdrive', sourceUrl, fileName, content, hash]
    );
  }

  return { title: fileName, contentLength: content.length };
}

async function fetchBrandIdentity(domain) {
  const res = await fetch(`https://www.brandidentity.com/api/v1/brands/${domain}`, {
    headers: { 'X-API-Key': process.env.BRANDIDENTITY_API_KEY || '' },
  });
  if (!res.ok) return null;
  return res.json();
}
