import { query } from '../config/db.js';

export async function create({ userId, tokenHash, portal, expiresAt }) {
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, portal, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, portal, expiresAt]
  );
}

// Check AND revoke in ONE atomic statement. Only one of two simultaneous
// requests using the same token can get a row back.
export async function consume(tokenHash) {
  const { rows } = await query(
    `UPDATE refresh_tokens
        SET revoked_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
      RETURNING user_id, portal`,
    [tokenHash]
  );
  return rows[0] || null;
}

export async function findByHash(tokenHash) {
  const { rows } = await query(
    'SELECT user_id, portal, revoked_at FROM refresh_tokens WHERE token_hash = $1',
    [tokenHash]
  );
  return rows[0] || null;
}

export async function revokeByHash(tokenHash) {
  const { rows } = await query(
    `UPDATE refresh_tokens SET revoked_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL
      RETURNING user_id, portal`,
    [tokenHash]
  );
  return rows[0] || null;
}

export async function revokeAllForUser(userId) {
  await query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
}