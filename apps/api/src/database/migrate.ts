import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pool } from './db.js';
export async function migrate() {
  const db = await pool.getConnection();
  try {
    const lock = await db.query("SELECT GET_LOCK('geuncha_migrations',30) AS acquired");
    if (lock[0].acquired !== 1) throw new Error('Migration lock timeout');
    await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))');
    for (const file of (await readdir('database/migrations')).filter(f => f.endsWith('.sql')).sort()) {
      const source = await readFile(path.join('database/migrations', file), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const applied = await db.query('SELECT checksum FROM schema_migrations WHERE version=?', [file]);
      if (applied.length) { if (applied[0].checksum !== checksum) throw new Error(`Migration checksum mismatch: ${file}`); continue; }
      // Initial DDL is deliberately idempotent: MariaDB DDL commits implicitly.
      for (const statement of source.split(';').map(s => s.trim()).filter(Boolean)) await db.query(statement);
      await db.query('INSERT INTO schema_migrations(version,checksum) VALUES (?,?)', [file,checksum]);
      console.log(`Applied ${file}`);
    }
  } finally { await db.query("SELECT RELEASE_LOCK('geuncha_migrations')"); db.release(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await migrate(); } finally { await pool.end(); }
}
