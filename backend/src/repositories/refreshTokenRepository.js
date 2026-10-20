import { query } from '../config/db.js';

export async function create({ userId, tokenHash, portal, expiresAt }) {
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, portal, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, portal, expiresAt]
  );
}