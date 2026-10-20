import { env } from '../config/env.js';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_DAYS } from './tokens.js';

// httpOnly: JavaScript in the page cannot read the cookie (blocks XSS theft)
// secure:   only sent over HTTPS (switched on in production; localhost is http)
// sameSite: strict = the browser won't send it from other sites (blocks CSRF)
const base = { httpOnly: true, secure: env.isProd, sameSite: 'strict' };

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie('access_token', accessToken, {
    ...base,
    path: '/',
    maxAge: ACCESS_TTL_SECONDS * 1000,
  });
  // The refresh cookie is only sent to /api/auth, never to other routes.
  res.cookie('refresh_token', refreshToken, {
    ...base,
    path: '/api/auth',
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res) {
  res.clearCookie('access_token', { ...base, path: '/' });
  res.clearCookie('refresh_token', { ...base, path: '/api/auth' });
}