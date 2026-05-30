import { getSession } from './auth.js';
import { queryOne } from './db.js';

export async function requireAdmin() {
  const user = await getSession();
  if (!user) throw new Error('Unauthorized');
  if (!user.is_admin) throw new Error('Forbidden');
  return user;
}
