import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

// Usage: pnpm db:migrate [file.sql]   (defaults to 001_initial.sql)
const file = process.argv[2] || '001_initial.sql';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const sql = readFileSync(new URL(`./${file.replace(/^migrations\//, '')}`, import.meta.url), 'utf8');

// Strip "--" comments first so a ";" inside a comment can't split a statement.
const statements = sql.replace(/^\s*--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
for (const stmt of statements) {
  await conn.query(stmt);
  console.log('OK:', stmt.slice(0, 60));
}

await conn.end();
console.log('Migration complete.');
