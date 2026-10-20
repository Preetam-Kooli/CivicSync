import { query } from '../config/db.js';

// Converts a database row (snake_case) into the shape our API returns.
// Note what is NOT here: password_hash. It never leaves the server.
export const toPublicUser = (row) => ({
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

// One atomic UPDATE: add 1 to the failed counter, and if it reaches the limit,
// lock the account and reset the counter. Doing it in SQL (not "read, add in
// JavaScript, write back") means two simultaneous attempts can't both slip through.
export async function registerFailedLogin(id, maxAttempts, lockMinutes) {
  await query(
    `UPDATE users
        SET failed_login_attempts = CASE
              WHEN failed_login_attempts + 1 >= $2::int THEN 0
              ELSE failed_login_attempts + 1 END,
            locked_until = CASE
              WHEN failed_login_attempts + 1 >= $2::int
              THEN now() + make_interval(mins => $3::int)
              ELSE locked_until END
      WHERE id = $1`,
    [id, maxAttempts, lockMinutes]
  );
}

export async function resetLoginState(id) {
  await query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
    [id]
  );
}