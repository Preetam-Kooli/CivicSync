import * as account from '../services/accountService.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookies.js';

const metaFrom = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

export async function profile(req, res) {
  res.json({ user: await account.updateProfile(req.auth.userId, req.body) });
}

export async function password(req, res) {
  const session = await account.changePassword(req.auth, req.body, metaFrom(req));
  setAuthCookies(res, session);
  res.json({ message: 'Password changed. Your other devices were signed out.' });
}

export async function logoutAll(req, res) {
  await account.logoutAll(req.auth, metaFrom(req));
  clearAuthCookies(res);
  res.json({ message: 'Signed out everywhere' });
}