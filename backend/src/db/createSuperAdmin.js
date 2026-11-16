import 'dotenv/config';
import crypto from 'node:crypto';
import { pool } from '../config/db.js';

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

const email = (getArg('email') || '').trim().toLowerCase();
const baseUrl = (getArg('base-url') || 'http://localhost:5173').replace(/\/+$/, '');
const force = args.includes('--force');

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(
    'Usage: npm run create-super-admin -- --email you@example.com [--base-url https://yoursite.onrender.com] [--force]'
  );
  process.exit(1);
}

async function main() {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM users WHERE role = 'super_admin'");
  if (rows[0].n > 0 && !force) {
    console.error('A super admin already exists. Add --force to create another invitation.');
    process.exitCode = 1;
    return;
  }

  const existing = await pool.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email]);
  if (existing.rowCount > 0) {
    console.error('An account with that email already exists.');
    process.exitCode = 1;
    return;
  }

  // Same hashing as the server uses: the database stores only the hash
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await pool.query(
    `UPDATE admin_invites SET revoked_at = now()
      WHERE lower(email) = lower($1) AND used_at IS NULL AND revoked_at IS NULL`,
    [email]
  );
  await pool.query(
    `INSERT INTO admin_invites (email, role, token_hash, expires_at)
     VALUES ($1, 'super_admin', $2, now() + interval '72 hours')`,
    [email, tokenHash]
  );

  console.log('\nSuper admin invitation created for', email);
  console.log('Open this link within 72 hours (treat it like a password):\n');
  console.log(`${baseUrl}/accept-invite?token=${token}\n`);
}

main()
  .catch((err) => {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());