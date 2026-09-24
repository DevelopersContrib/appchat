// Manage workspace members from the command line (members can sign in and see the workspace's public channels).
//
//   node --env-file=.env.local scripts/team-member.js --tenant acme add jane@acme.com [member|admin|owner]
//   node --env-file=.env.local scripts/team-member.js --tenant acme remove jane@acme.com
//   node --env-file=.env.local scripts/team-member.js --tenant acme list
import mysql from 'mysql2/promise';

const args = process.argv.slice(2);
const tenantFlag = args.indexOf('--tenant');
const tenantSlug = tenantFlag >= 0 ? args.splice(tenantFlag, 2)[1] : null;
if (!tenantSlug) exit('Pass --tenant <workspace slug>.');
const [command, rawEmail, roleArg] = args;
const role = roleArg || 'member';
const email = rawEmail?.trim().toLowerCase();

const ROLES = ['owner', 'admin', 'member', 'guest'];

const db = await mysql.createConnection(process.env.DATABASE_URL);
const [[tenant]] = await db.query('SELECT id, name FROM tenants WHERE slug = ?', [tenantSlug]);
if (!tenant) exit(`No workspace with slug "${tenantSlug}".`);

if (command === 'list') {
  const [rows] = await db.query(
    `SELECT u.email, u.name, tm.role, u.last_seen_at FROM tenant_members tm
     JOIN users u ON u.id = tm.user_id WHERE tm.tenant_id = ? ORDER BY tm.role, u.email`,
    [tenant.id]
  );
  console.table(rows);
} else if (command === 'add') {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) exit('Give a valid email.');
  if (!ROLES.includes(role)) exit(`Role must be one of: ${ROLES.join(', ')}`);

  let [[user]] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (!user) {
    const [res] = await db.query('INSERT INTO users (email) VALUES (?)', [email]);
    user = { id: res.insertId };
  }
  // Only change an existing member's role when one is given explicitly.
  await db.query(
    `INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE role = ${roleArg ? 'VALUES(role)' : 'role'}`,
    [tenant.id, user.id, role]
  );
  const [[{ role: finalRole }]] = await db.query(
    'SELECT role FROM tenant_members WHERE tenant_id = ? AND user_id = ?',
    [tenant.id, user.id]
  );
  const [res] = await db.query(
    `INSERT IGNORE INTO channel_members (channel_id, user_id)
     SELECT id, ? FROM channels WHERE tenant_id = ? AND is_private = 0 AND is_dm = 0`,
    [user.id, tenant.id]
  );
  console.log(`${email} is in ${tenant.name} as ${finalRole} (joined ${res.affectedRows} new channels).`);
} else if (command === 'remove') {
  if (!email) exit('Give an email.');
  const [[user]] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (!user) exit(`${email} not found.`);
  await db.query(
    `DELETE cm FROM channel_members cm JOIN channels c ON c.id = cm.channel_id
     WHERE c.tenant_id = ? AND cm.user_id = ?`,
    [tenant.id, user.id]
  );
  await db.query('DELETE FROM tenant_members WHERE tenant_id = ? AND user_id = ?', [tenant.id, user.id]);
  console.log(`Removed ${email} from ${tenant.name}. They lose access right away.`);
} else {
  exit('Usage: team-member.js --tenant <slug> add <email> [role] | remove <email> | list');
}

await db.end();

function exit(msg) {
  console.error(msg);
  process.exit(1);
}
