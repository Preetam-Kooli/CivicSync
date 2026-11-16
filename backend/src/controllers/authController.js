import * as authService from '../services/authService.js';
import * as twoFactorService from '../services/twoFactorService.js';
import * as inviteService from '../services/inviteService.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookies.js';

const metaFrom = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

export async function register(req, res) {
  const user = await authService.registerCitizen(req.body);
  res.status(201).json({ user });
}

export async function login(req, res) {
  const result = await authService.login(req.body, metaFrom(req));

  // Admin portal: password was right, now the 2FA step. No cookies yet.
  if (result.step) {
    return res.json({ step: result.step, challengeToken: result.challengeToken });
  }

  setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
  res.json({ user: result.user, portal: req.body.portal });
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
    clearAuthCookies(res);
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

export async function twoFactorSetup(req, res) {
  res.json(await twoFactorService.startSetup(req.body.challengeToken));
}

export async function twoFactorVerify(req, res) {
  const { user, accessToken, refreshToken } = await twoFactorService.verify(req.body, metaFrom(req));
  setAuthCookies(res, { accessToken, refreshToken });
  res.json({ user, portal: 'admin' });
}

export async function inviteInspect(req, res) {
  res.json(await inviteService.inspect(req.body.token));
}

export async function inviteAccept(req, res) {
  res.json(await inviteService.accept(req.body, metaFrom(req)));
}