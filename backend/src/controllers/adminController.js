import * as inviteService from '../services/inviteService.js';
import * as userAdminService from '../services/userAdminService.js';
import { AppError } from '../utils/AppError.js';

const metaFrom = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });
const actorFrom = (req) => ({ userId: req.auth.userId });

// IDs from the URL are text. Accept only plain digits.
function parseId(value) {
  if (!/^\d{1,18}$/.test(value)) throw new AppError(400, 'Invalid id');
  return value;
}

export async function createInvite(req, res) {
  res.status(201).json(await inviteService.createInvite(req.body, actorFrom(req), metaFrom(req)));
}

export async function listInvites(req, res) {
  res.json({ invites: await inviteService.list() });
}

export async function revokeInvite(req, res) {
  await inviteService.revoke(parseId(req.params.id), actorFrom(req), metaFrom(req));
  res.json({ message: 'Invitation revoked' });
}

export async function listUsers(req, res) {
  res.json({ users: await userAdminService.list() });
}

export async function deactivateUser(req, res) {
  await userAdminService.setActive(parseId(req.params.id), false, actorFrom(req), metaFrom(req));
  res.json({ message: 'User deactivated' });
}

export async function activateUser(req, res) {
  await userAdminService.setActive(parseId(req.params.id), true, actorFrom(req), metaFrom(req));
  res.json({ message: 'User activated' });
}

export async function resetUserTwoFactor(req, res) {
  await userAdminService.resetTwoFactor(parseId(req.params.id), actorFrom(req), metaFrom(req));
  res.json({ message: 'Two-factor authentication reset' });
}