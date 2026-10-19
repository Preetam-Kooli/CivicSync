import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';

// In ES modules there is no __dirname, so we rebuild it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This file is backend/src/db, so go up two levels to reach backend/migrations
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

async function run() {
  // A small table that remembers which migration files already ran
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort(); // 001, 002, 003... runs in order

  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip    ${file} (already applied)`);
      continue;
    }

    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      // A transaction: either the whole file succeeds, or nothing changes.
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`applied ${file}`);
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`FAILED  ${file}: ${err.message}`);
      process.exitCode = 1;
      break; // stop here, don't run later migrations
    } finally {
      client.release();
    }
  }

  await pool.end();
  if (process.exitCode !== 1) console.log(`Done. ${count} migration(s) applied.`);
}

run();