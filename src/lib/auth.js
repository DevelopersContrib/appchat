import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { queryOne, insert, query } from './db.js';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const COOKIE_NAME = 'appchat_session';
let magicClient = null;

async function getMagicClient() {
  if (magicClient) return magicClient;
  const { Magic } = await import('@magic-sdk/admin');
  magicClient = new Magic(process.env.MAGIC_SECRET_KEY);
  return magicClient;
}

// membersOnly: only platform admins or people already added to a workspace may sign in.
export async function authenticateWithMagic(didToken, { adminOnly = false, membersOnly = false } = {}) {
  const magic = await getMagicClient();
  magic.token.validate(didToken);
  const metadata = await magic.users.getMetadataByToken(didToken);

  let user = await queryOne('SELECT * FROM users WHERE magic_issuer = ?', [metadata.issuer]);
  if (!user && metadata.email) {
    user = await queryOne('SELECT * FROM users WHERE email = ?', [metadata.email]);
  }

  if (adminOnly || membersOnly) {
    const allowed = user && (user.is_admin || (membersOnly && await queryOne(
      'SELECT 1 FROM tenant_members WHERE user_id = ? LIMIT 1',
      [user.id]
    )));
    if (!allowed) {
      throw new Error(adminOnly ? 'Admin access required' : 'Not a team member');
    }

    await query(
      'UPDATE users SET magic_issuer = COALESCE(magic_issuer, ?), last_seen_at = NOW() WHERE id = ?',
      [metadata.issuer, user.id]
    );
    user = await queryOne('SELECT * FROM users WHERE id = ?', [user.id]);
  } else if (!user) {
    const id = await insert(
      'INSERT INTO users (email, magic_issuer, last_seen_at) VALUES (?, ?, NOW())',
      [metadata.email, metadata.issuer]
    );
    user = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
  } else {
    await query(
      'UPDATE users SET magic_issuer = COALESCE(magic_issuer, ?), last_seen_at = NOW() WHERE id = ?',
      [metadata.issuer, user.id]
    );
    user = await queryOne('SELECT * FROM users WHERE id = ?', [user.id]);
  }

  const token = await new SignJWT({ userId: user.id, email: user.email, isAdmin: !!user.is_admin })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  return { user, token };
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [payload.userId]);
    return user;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const user = await getSession();
  if (!user) throw new Error('Unauthorized');
  return user;
}
