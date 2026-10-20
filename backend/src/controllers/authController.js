import * as authService from '../services/authService.js';
import { setAuthCookies } from '../utils/cookies.js';

export async function register(req, res) {
  const user = await authService.registerCitizen(req.body);
  res.status(201).json({ user });
}

export async function login(req, res) {
  const meta = { ip: req.ip, userAgent: req.get('user-agent') };
  const { user, accessToken, refreshToken } = await authService.login(req.body, meta);

  // Tokens go into httpOnly cookies, NOT into the JSON response.
  setAuthCookies(res, { accessToken, refreshToken });

  // The frontend uses "portal" to decide which dashboard to show.
  res.json({ user, portal: req.body.portal });
}