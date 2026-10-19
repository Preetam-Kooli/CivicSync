import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// A Pool keeps several database connections open and reuses them,
// which is much faster than opening a new connection per request.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// A small helper so the rest of the code can write: await query('SELECT ...', [values])
// The $1, $2 placeholders keep user input separate from the SQL text.
// This is how we prevent SQL injection (a security rule from your plan).
export const query = (text, params) => pool.query(text, params);
