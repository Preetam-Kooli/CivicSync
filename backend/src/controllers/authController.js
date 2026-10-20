import * as authService from '../services/authService.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookies.js';

const metaFrom = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

export async function register(req, res) {
  const user = await authService.registerCitizen(req.body);
  res.status(201).json({ user });
}

export async function login(req, res) {
  const { user, accessToken, refreshToken } = await authService.login(req.body, metaFrom(req));

  // Tokens go into httpOnly cookies, NOT into the JSON response.
  setAuthCookies(res, { accessToken, refreshToken });

  // The frontend uses "portal" to decide which dashboard to show.
  res.json({ user, portal: req.body.portal });
}

export async function refresh(req, res) {
  try {
    const { user, portal, accessToken, refreshToken } = await authService.refreshSession(
      req.cookies?.refresh_token,
      metaFrom(req)
    );
    setAuthCookies(res, { accessToken, refreshToken });
    res.json({ user, portal });
  } catch (err) {
    clearAuthCookies(res); // a failed refresh means the cookies are useless
    throw err;
  }
}

export async function logout(req, res) {
  await authService.logout(req.cookies?.refresh_token, metaFrom(req));
  clearAuthCookies(res);
  res.json({ message: 'Logged out' });
}

export function me(req, res) {
  res.json({ user: req.auth.user, portal: req.auth.portal });
}