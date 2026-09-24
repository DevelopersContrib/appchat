import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { withWorkspaceAdmin, saveSettings, audit } from '@/lib/workspace.js';
import { sanitizeString, sanitizeUrl } from '@/lib/security.js';

// General info, rules and moderation settings for a workspace.
export const GET = withWorkspaceAdmin(async (request, { tenant, settings }) => {
  return NextResponse.json({
    name: tenant.name,
    slug: tenant.slug,
    domain: tenant.domain,
    logoUrl: tenant.logo_url,
    brandColor: tenant.brand_color,
    description: settings.description || '',
    rules: settings.rules || '',
    requireRules: Boolean(settings.requireRules),
    bannedWords: settings.bannedWords || [],
    emailDigest: settings.emailDigest !== false,
    emailOfflineDms: settings.emailOfflineDms !== false,
  });
});

export const PUT = withWorkspaceAdmin(async (request, { user, tenant, settings }) => {
  const b = await request.json().catch(() => ({}));
  const name = sanitizeString(b.name, 255) || tenant.name;
  const brandColor = /^#[0-9a-f]{6}$/i.test(b.brandColor || '') ? b.brandColor : tenant.brand_color;
  const logoUrl = b.logoUrl ? sanitizeUrl(b.logoUrl) : null;
  const domain = sanitizeString(b.domain, 255).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') || null;

  const next = {
    ...settings,
    description: sanitizeString(b.description, 1000),
    rules: sanitizeString(b.rules, 5000),
    requireRules: Boolean(b.requireRules),
    bannedWords: (Array.isArray(b.bannedWords) ? b.bannedWords : String(b.bannedWords || '').split(','))
      .map((w) => sanitizeString(String(w), 50).toLowerCase())
      .filter(Boolean)
      .slice(0, 200),
    emailDigest: b.emailDigest !== false,
    emailOfflineDms: b.emailOfflineDms !== false,
  };

  await query('UPDATE tenants SET name = ?, brand_color = ?, logo_url = ?, domain = ? WHERE id = ?', [name, brandColor, logoUrl, domain, tenant.id]);
  await saveSettings(tenant.id, next);
  // Changing the rules asks everyone to accept them again.
  if (next.requireRules && next.rules !== (settings.rules || '')) {
    await query('UPDATE tenant_members SET rules_accepted_at = NULL WHERE tenant_id = ?', [tenant.id]);
  }
  await audit(tenant.id, user.id, 'settings.update', tenant.slug, { name, requireRules: next.requireRules, bannedWords: next.bannedWords.length });
  return NextResponse.json({ ok: true });
});
