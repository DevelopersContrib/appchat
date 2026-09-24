import 'server-only';
import { getVnocPool } from './domains.js';
import { query } from './db.js';

// contrib.com profiles live in the VNOC database (members + MemberProfile). Photo URL rules mirror
// contrib.com/nextjs-app/src/lib/media.ts (profileMediaUrl / vnocPictureUrl).
const CONTRIB_S3 = 'https://contribaws.s3.us-west-2.amazonaws.com';
const PROFILE_PREFIX = 'contrib.com/uploads/profile';
const PROFILE_KEY_RE = /^(profile|challenge)_\d+_\d+\.[a-z0-9]+$/i;
const VNOC_UPLOADS = 'https://manage.vnoc.com';

export function contribProfileUrl(username) {
  return username ? `https://www.contrib.com/profile/${encodeURIComponent(username)}` : null;
}

function fileOf(path) {
  return path.split('?')[0].split('#')[0].split('/').filter(Boolean).pop() || '';
}

function profileImageUrl(raw) {
  const v = (raw || '').trim();
  if (!v || v === 'null' || v === 'undefined') return null;
  const dead = /^https?:\/\/(www\.)?contrib\.com\/uploads\/profile\/(.+)$/i.exec(v);
  if (dead) return PROFILE_KEY_RE.test(fileOf(dead[2])) ? `${CONTRIB_S3}/${PROFILE_PREFIX}/${fileOf(dead[2])}` : null;
  if (v.startsWith('https://')) return v;
  if (v.startsWith('http://')) return v.replace('http://', 'https://');
  if (v.startsWith('//')) return `https:${v}`;
  if (v.startsWith('/uploads/profile/') || v.startsWith('contrib.com/')) {
    return PROFILE_KEY_RE.test(fileOf(v)) ? `${CONTRIB_S3}/${PROFILE_PREFIX}/${fileOf(v)}` : null;
  }
  return null;
}

function vnocPictureUrl(raw) {
  const v = (raw || '').trim();
  if (!v || v === 'null' || v === 'undefined') return null;
  if (v.startsWith('https://')) return v;
  if (v.startsWith('http://')) return v.replace('http://', 'https://');
  if (v.startsWith('//')) return `https:${v}`;
  return `${VNOC_UPLOADS}/uploads/picture/${v}`;
}

export async function getContribProfile(email) {
  if (!email || !process.env.VNOC_DATABASE_URL) return null;
  const [rows] = await getVnocPool().query(
    `SELECT m.member_id, m.firstname, m.lastname, m.username, m.picture, p.profile_image
     FROM members m LEFT JOIN MemberProfile p ON p.member_id = m.member_id
     WHERE LOWER(m.email) = LOWER(?)
     ORDER BY m.is_active DESC, m.member_id DESC LIMIT 1`,
    [email]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    username: r.username || null,
    name: `${r.firstname || ''} ${r.lastname || ''}`.trim() || r.username || null,
    avatar: profileImageUrl(r.profile_image) || vnocPictureUrl(r.picture),
  };
}

/** contrib.com is the source of truth for name and photo; keep AppChat's copy in sync. Never throws. */
export async function syncContribProfile(user) {
  try {
    const p = await getContribProfile(user.email);
    if (!p) return user;
    await query(
      'UPDATE users SET name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url), contrib_username = ? WHERE id = ?',
      [p.name, p.avatar, p.username, user.id]
    );
    return { ...user, name: p.name || user.name, avatar_url: p.avatar || user.avatar_url, contrib_username: p.username };
  } catch (err) {
    console.error('[contrib] profile sync failed:', err.message);
    return user;
  }
}
