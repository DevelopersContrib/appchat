import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth.js';
import { insert, queryOne } from '@/lib/db.js';

export async function POST(request) {
  try {
    const user = await requireSession();
    const { name, slug } = await request.json();

    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json({ error: 'Name and slug required' }, { status: 400 });
    }

    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length < 2) {
      return NextResponse.json({ error: 'Invalid slug format' }, { status: 400 });
    }

    const existing = await queryOne('SELECT id FROM tenants WHERE slug = ?', [slug]);
    if (existing) {
      return NextResponse.json({ error: 'This URL is already taken' }, { status: 409 });
    }

    const tenantId = await insert(
      'INSERT INTO tenants (slug, name, logo_url) VALUES (?, ?, ?)',
      [slug, name.trim(), `https://brandidentity.com/logo/${slug}.com`]
    );

    await insert(
      'INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, ?)',
      [tenantId, user.id, 'owner']
    );

    const generalId = await insert(
      'INSERT INTO channels (tenant_id, name, description, created_by) VALUES (?, ?, ?, ?)',
      [tenantId, 'general', 'General discussion', user.id]
    );

    await insert(
      'INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)',
      [generalId, user.id]
    );

    await insert(
      'INSERT INTO messages (channel_id, body, type) VALUES (?, ?, ?)',
      [generalId, `Welcome to ${name.trim()}! This is your #general channel.`, 'system']
    );

    return NextResponse.json({ slug, id: tenantId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
