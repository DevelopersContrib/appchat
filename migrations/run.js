import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const sql = readFileSync(new URL('./001_initial.sql', import.meta.url), 'utf8');

for (const stmt of sql.split(';').filter(s => s.trim())) {
  await conn.execute(stmt);
  console.log('OK:', stmt.trim().slice(0, 60));
}

await conn.end();
console.log('Migration complete.');
