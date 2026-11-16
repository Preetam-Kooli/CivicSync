import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TTL_DAYS = 7;

export function signAccessToken(user, portal) {
  return jwt.sign({ role: user.role, portal }, env.jwtAccessSecret, {
    subject: String(user.id),
    expiresIn: ACCESS_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

// What we store in the database instead of the token itself.
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// A "challenge" token proves "this person just passed the password step".
// It lives 5 minutes, is useless for API access (different audience, no role),
// and is only accepted by the 2FA endpoints.
const CHALLENGE_AUDIENCE = 'civicsync-2fa';

export function signChallengeToken(user) {
  return jwt.sign({ purpose: '2fa' }, env.jwtAccessSecret, {
    subject: String(user.id),
    audience: CHALLENGE_AUDIENCE,
    expiresIn: 5 * 60,
    algorithm: 'HS256',
  });
}

// Throws if the token is expired, tampered with, or not a challenge token
export function verifyChallengeToken(token) {
  return jwt.verify(token, env.jwtAccessSecret, {
    audience: CHALLENGE_AUDIENCE,
    algorithms: ['HS256'],
  });
}