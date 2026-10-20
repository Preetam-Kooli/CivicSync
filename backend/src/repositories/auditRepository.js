import { query } from '../config/db.js';

export async function record({
  userId = null,
  email = null,
  portal = null,
  action,
  success,
  ip = null,
  userAgent = null,
}) {
  await query(
    `INSERT INTO audit_logs (user_id, email_attempted, portal, action, success, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, email, portal, action, success, ip, userAgent ? userAgent.slice(0, 255) : null]
  );
}