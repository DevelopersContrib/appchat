import 'server-only';
import { NextResponse } from 'next/server';
import { getSession } from './auth.js';
import { getVnocAccess } from './vnoc.js';
import { queryOne, insert } from './db.js';

// Shared wrapper for /api/vnoc/* routes: signed-in user + their VNOC access level.
export function withVnoc(handler) {
  return async (request, ctx) => {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      const access = await getVnocAccess(user);
      return await handler(request, { ...ctx, user, access });
    } catch (err) {
      console.error('[vnoc]', err);
      return NextResponse.json({ error: err.message || 'VNOC request failed' }, { status: 502 });
    }
  };
}

// Posts a card message into a channel the user belongs to (used after creating tasks/sprints).
export async function postCard(channelId, user, body, card) {
  if (!channelId) return null;
  const member = await queryOne(
    'SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
    [channelId, user.id]
  );
  if (!member) return null;
  return insert(
    'INSERT INTO messages (channel_id, user_id, body, type, metadata) VALUES (?, ?, ?, ?, ?)',
    [channelId, user.id, body, 'text', JSON.stringify({ card })]
  );
}
