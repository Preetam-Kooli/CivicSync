import { query, pool } from '../config/db.js';

// An expired but never-revoked invitation would still block a new one
// (one open invitation per email), so retire it first.
export async function expireOldOpen(email) {
  await query(
    `UPDATE admin_invites SET revoked_at = now()
      WHERE lower(email) = lower($1) AND used_at IS NULL
        AND revoked_at IS NULL AND expires_at <= now()`,
    [email]
  );
}

export async function create({ email, role, department, tokenHash, createdBy, expiresAt }) {
  const { rows } = await query(
    `INSERT INTO admin_invites (email, role, department, token_hash, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, role, department, expires_at`,
    [email, role, department, tokenHash, createdBy, expiresAt]
  );
  return rows[0];
}

export async function findOpenByHash(tokenHash) {
  const { rows } = await query(
    `SELECT email, role, department FROM admin_invites
      WHERE token_hash = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );
  return rows[0] || null;
}

export async function list() {
  const { rows } = await query(
    `SELECT i.id, i.email, i.role, i.department, i.expires_at, i.used_at, i.revoked_at,
            i.created_at, u.full_name AS created_by_name
       FROM admin_invites i LEFT JOIN users u ON u.id = i.created_by
      ORDER BY i.id DESC LIMIT 100`
  );
  return rows;
}

export async function revoke(id) {
  const { rows } = await query(
    `UPDATE admin_invites SET revoked_at = now()
      WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL
      RETURNING email`,
    [id]
  );
  return rows[0] || null;
}

// One transaction: mark the invitation used AND create the user, or neither.
// The UPDATE ... RETURNING means two people cannot both use the same link.
export async function acceptInvite(tokenHash, { fullName, passwordHash }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inv = await client.query(
      `UPDATE admin_invites SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
        RETURNING email, role, department`,
      [tokenHash]
    );
    if (inv.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const { email, role, department } = inv.rows[0];
    const created = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, department, email_verified)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [fullName, email, passwordHash, role, department]
    );
    await client.query('COMMIT');
    return created.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}