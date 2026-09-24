// Shared by the Discord and Slack importers. Plain module (no server-only) so CLI scripts can use it too.
// Imported rows are tracked by messages.source + external_id (unique per channel), so re-runs never duplicate.

/** Finds the channel previously linked to this external channel, else one with the same name, else creates it. */
export async function ensureImportedChannel(db, { tenantId, source, externalId, name, topic = '', isPrivate = false, memberIds = null }) {
  const [[linked]] = await db.query(
    'SELECT id FROM channels WHERE tenant_id = ? AND source = ? AND external_id = ?',
    [tenantId, source, externalId]
  );
  let channelId = linked?.id;

  if (!channelId) {
    const [[byName]] = await db.query(
      'SELECT id FROM channels WHERE tenant_id = ? AND name = ? AND source IS NULL AND is_dm = 0 AND archived_at IS NULL LIMIT 1',
      [tenantId, name]
    );
    if (byName) {
      channelId = byName.id;
      await db.query('UPDATE channels SET source = ?, external_id = ? WHERE id = ?', [source, externalId, channelId]);
    } else {
      const [res] = await db.query(
        'INSERT INTO channels (tenant_id, name, description, is_private, source, external_id) VALUES (?, ?, ?, ?, ?, ?)',
        [tenantId, name, String(topic || '').slice(0, 500), isPrivate ? 1 : 0, source, externalId]
      );
      channelId = res.insertId;
    }
  }

  if (isPrivate && memberIds) {
    if (memberIds.length) {
      await db.query('INSERT IGNORE INTO channel_members (channel_id, user_id) SELECT ?, user_id FROM tenant_members WHERE tenant_id = ? AND user_id IN (?)', [channelId, tenantId, memberIds]);
    }
  } else {
    await db.query('INSERT IGNORE INTO channel_members (channel_id, user_id) SELECT ?, user_id FROM tenant_members WHERE tenant_id = ?', [channelId, tenantId]);
  }
  return channelId;
}

/**
 * rows: [{ userId, body, externalId, createdAt, editedAt, metadata, attachments: [{title,url,mimeType,size}] }]
 * Inserts in one transaction; returns how many messages were new.
 */
export async function insertImportedMessages(db, channelId, source, rows) {
  if (!rows.length) return 0;
  await db.beginTransaction();
  try {
    const [inserted] = await db.query(
      `INSERT IGNORE INTO messages (channel_id, user_id, body, type, metadata, source, external_id, created_at, edited_at)
       VALUES ?`,
      [rows.map((r) => [channelId, r.userId, r.body, 'text', JSON.stringify(r.metadata), source, r.externalId, r.createdAt, r.editedAt])]
    );

    const withFiles = rows.filter((r) => r.attachments?.length);
    if (withFiles.length) {
      const [ids] = await db.query(
        'SELECT id, external_id FROM messages WHERE channel_id = ? AND source = ? AND external_id IN (?)',
        [channelId, source, withFiles.map((r) => r.externalId)]
      );
      const idByExternal = new Map(ids.map((r) => [r.external_id, r.id]));
      const attachmentRows = withFiles.flatMap((r) =>
        r.attachments.map((a) => [idByExternal.get(r.externalId), 'file', String(a.title || 'file').slice(0, 500), a.url, a.mimeType || null, a.size || null])
      );
      // Only attach to messages created by this insert, so a re-run can't duplicate attachments.
      const [[{ firstNew }]] = await db.query('SELECT LAST_INSERT_ID() AS firstNew');
      const fresh = attachmentRows.filter(([messageId]) => messageId && inserted.affectedRows && messageId >= firstNew);
      if (fresh.length) {
        await db.query('INSERT INTO message_attachments (message_id, type, title, url, mime_type, size_bytes) VALUES ?', [fresh]);
      }
    }
    await db.commit();
    return inserted.affectedRows;
  } catch (err) {
    await db.rollback();
    throw err;
  }
}

export function toMysqlDate(date) {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}
