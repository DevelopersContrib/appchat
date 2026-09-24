import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { queryOne } from '@/lib/db.js';
import { parseChannelFromKey, createDownloadUrl } from '@/lib/storage.js';

// Files are private to their channel: check membership, then redirect to a 5-minute signed URL.
export async function GET(request, { params }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key = (await params).key.map(decodeURIComponent).join('/');
  const scope = parseChannelFromKey(key);
  if (!scope) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const attachment = await queryOne(
    `SELECT a.title, a.mime_type FROM message_attachments a
     JOIN messages m ON m.id = a.message_id
     JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = ?
     WHERE a.storage_key = ? AND m.channel_id = ?
     LIMIT 1`,
    [user.id, key, scope.channelId]
  );
  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = await createDownloadUrl(key, { filename: attachment.title, contentType: attachment.mime_type });
  return NextResponse.redirect(url, { headers: { 'Cache-Control': 'private, max-age=240' } });
}
