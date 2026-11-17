import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// A Pool keeps several database connections open and reuses them.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Only for connecting to a hosted database from OUTSIDE its network (for
  // example a script on your laptop against Render's External URL). The
  // connection is encrypted, but the server certificate is not verified.
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

// $1, $2 placeholders keep user input separate from the SQL text (prevents SQL injection)
export const query = (text, params) => pool.query(text, params);
// Runs fn(client) inside one transaction: everything succeeds together or is rolled back.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}