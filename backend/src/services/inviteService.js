import crypto from 'node:crypto';
import * as inviteRepo from '../repositories/inviteRepository.js';
import * as userRepo from '../repositories/userRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/AppError.js';
import { hashToken, signChallengeToken } from '../utils/tokens.js';
import { hashPassword } from './authService.js';

const INVITE_TTL_HOURS = 72;

// One message for every kind of bad link: no hints for guessers
const invalidInvite = () => new AppError(404, 'This invitation is invalid or has expired');

const statusOf = (row) =>
  row.used_at ? 'used'
  : row.revoked_at ? 'revoked'
  : new Date(row.expires_at) <= new Date() ? 'expired'
  : 'pending';

export async function createInvite({ email, role, department }, actor, meta) {
  if (await userRepo.findByEmail(email)) {
    throw new AppError(409, 'An account with this email already exists');
  }
  await inviteRepo.expireOldOpen(email);

  // The raw token exists only in this response. The database keeps its hash.
  const token = crypto.randomBytes(32).toString('base64url');

  let invite;
  try {
    invite = await inviteRepo.create({
      email,
      role,
      department: role === 'staff' ? department : null,
      tokenHash: hashToken(token),
      createdBy: actor.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000),
    });
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError(409, 'An open invitation for this email already exists. Revoke it first.');
    }
    throw err;
  }

  await auditRepo.record({
    userId: actor.userId, email, portal: 'admin', action: 'invite_created', success: true, ...meta,
  });

  return {
    token,
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      department: invite.department,
      expiresAt: invite.expires_at,
    },
  };
}

export async function list() {
  const rows = await inviteRepo.list();
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    department: r.department,
    status: statusOf(r),
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    createdBy: r.created_by_name,
  }));
}

export async function revoke(id, actor, meta) {
  const revoked = await inviteRepo.revoke(id);
  if (!revoked) throw new AppError(404, 'Invitation not found or already used');
  await auditRepo.record({
    userId: actor.userId, email: revoked.email, portal: 'admin', action: 'invite_revoked', success: true, ...meta,
  });
}

// Lets the page show "you were invited as ..." before asking for a password
export async function inspect(token) {
  const invite = await inviteRepo.findOpenByHash(hashToken(token));
  if (!invite) throw invalidInvite();
  return { email: invite.email, role: invite.role, department: invite.department };
}

export async function accept({ token, fullName, password }, meta) {
  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await inviteRepo.acceptInvite(hashToken(token), { fullName, passwordHash });
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError(409, 'An account with this email already exists');
    }
    throw err;
  }
  if (!user) throw invalidInvite();

  await auditRepo.record({
    userId: user.id, email: user.email, portal: 'admin', action: 'invite_accepted', success: true, ...meta,
  });

  // The new admin must now enroll their authenticator app (step 2)
  return { step: 'totp_setup_required', challengeToken: signChallengeToken(user) };
}