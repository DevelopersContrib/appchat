import { Magic } from '@magic-sdk/admin';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { queryOne, insert, query } from './db.js';

const magic = new Magic(process.env.MAGIC_SECRET_KEY);
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const COOKIE_NAME = 'appchat_session';

export async function authenticateWithMagic(didToken) {
  magic.token.validate(didToken);
  const metadata = await magic.users.getMetadataByToken(didToken);

  let user = await queryOne('SELECT * FROM users WHERE magic_issuer = ?', [metadata.issuer]);

  if (!user) {
    const id = await insert(
      'INSERT INTO users (email, magic_issuer, last_seen_at) VALUES (?, ?, NOW())',
      [metadata.email, metadata.issuer]
    );
    user = { id, email: metadata.email, magic_issuer: metadata.issuer };
  } else {
    await query('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [user.id]);
  }

  const token = await new SignJWT({ userId: user.id, email: user.email })
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
