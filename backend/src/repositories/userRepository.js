import { query } from '../config/db.js';

// Converts a database row (snake_case) into the shape our API returns.
// Note what is NOT here: password_hash. It never leaves the server.
const toPublicUser = (row) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  phone: row.phone,
  role: row.role,
  createdAt: row.created_at,
});

export async function findByEmail(email) {
  const { rows } = await query(
    'SELECT * FROM users WHERE lower(email) = lower($1)',
    [email]
  );
  return rows[0] || null;
}

// Public registration can ONLY create citizens: the role is fixed here
// in SQL, not taken from the request.
export async function createCitizen({ fullName, email, phone, passwordHash }) {
  const { rows } = await query(
    `INSERT INTO users (full_name, email, phone, password_hash, role)
     VALUES ($1, $2, $3, $4, 'citizen')
     RETURNING id, full_name, email, phone, role, created_at`,
    [fullName, email, phone ?? null, passwordHash]
  );
  return toPublicUser(rows[0]);
}