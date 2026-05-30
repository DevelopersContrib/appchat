import mysql from 'mysql2/promise';

let vnocPool;

function getVnocPool() {
  if (!vnocPool) {
    vnocPool = mysql.createPool({
      host: 'vnocdb.cyh3tjizziz6.us-west-2.rds.amazonaws.com',
      user: 'maida',
      password: 'vschool3030',
      database: 'domaindi_managedomain',
      waitForConnections: true,
      connectionLimit: 5,
      idleTimeout: 60000,
    });
  }
  return vnocPool;
}

export async function findVnocDomain(domainName) {
  const clean = domainName.replace(/\.com$/, '').toLowerCase();

  const [rows] = await getVnocPool().execute(
    `SELECT d.domain_id, d.domain_name, d.title, d.logo, d.category_id, d.account_type, d.description,
            c.category_name
     FROM domain d
     LEFT JOIN category c ON c.category_id = d.category_id
     WHERE d.domain_name = ? OR d.domain_name = ?
     LIMIT 1`,
    [domainName, clean + '.com']
  );

  return rows[0] || null;
}

export async function searchVnocDomains(query, limit = 20) {
  const [rows] = await getVnocPool().execute(
    `SELECT d.domain_id, d.domain_name, d.title, d.logo, d.category_id, d.account_type,
            c.category_name
     FROM domain d
     LEFT JOIN category c ON c.category_id = d.category_id
     WHERE d.domain_name LIKE ?
     ORDER BY d.domain_name
     LIMIT ?`,
    [`%${query}%`, limit]
  );

  return rows;
}

export async function getVnocDomainCount() {
  const [rows] = await getVnocPool().execute('SELECT COUNT(*) as total FROM domain');
  return rows[0].total;
}
