import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TTL_DAYS = 7;

// The JWT carries who the user is (sub), their role, and WHICH PORTAL it was
// issued for. Admin routes will later accept only portal = "admin" tokens.
export function signAccessToken(user, portal) {
  return jwt.sign({ role: user.role, portal }, env.jwtAccessSecret, {
    subject: String(user.id),
    expiresIn: ACCESS_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

// A refresh token is just a long random string (not a JWT).
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

// What we store in the database instead of the token itself.
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}