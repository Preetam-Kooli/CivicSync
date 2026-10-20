import bcrypt from 'bcryptjs';
import * as userRepo from '../repositories/userRepository.js';
import * as refreshRepo from '../repositories/refreshTokenRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/AppError.js';
import { PORTAL_ROLES, canUsePortal } from '../config/portals.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  REFRESH_TTL_DAYS,
} from '../utils/tokens.js';

// Cost 10 means 2^10 rounds of hashing: slow enough to frustrate
// attackers, fast enough that users don't notice.
const BCRYPT_COST = 10;

// Stricter lockout for accounts with admin-side roles
const LOCK_RULES = {
  citizen: { maxAttempts: 5, lockMinutes: 15 },
  admin: { maxAttempts: 3, lockMinutes: 30 },
};
const lockRuleFor = (role) =>
  PORTAL_ROLES.admin.includes(role) ? LOCK_RULES.admin : LOCK_RULES.citizen;

// Used when the email doesn't exist, so that case takes as long as a real
// password check (otherwise response times would reveal which emails exist).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

// Creates a fresh access token + refresh token, and stores the refresh hash.
// Used by both login and refresh.
async function issueSession(user, portal) {
  const accessToken = signAccessToken(user, portal);
  const refreshToken = generateRefreshToken();
  await refreshRepo.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    portal,
    expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  return { accessToken, refreshToken };
}

export async function registerCitizen({ fullName, email, phone, password }) {
  const existing = await userRepo.findByEmail(email);
  if (existing) {
    throw new AppError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  try {
    return await userRepo.createCitizen({ fullName, email, phone, passwordHash });
  } catch (err) {
    // 23505 is PostgreSQL's "unique violation" code
    if (err.code === '23505') {
      throw new AppError(409, 'An account with this email already exists');
    }
    throw err;
  }
}

export async function login({ email, password, portal }, meta) {
  const user = await userRepo.findByEmail(email);

  // Records the failure in the audit log, then throws the SAME generic error
  const fail = async (action, userId = null) => {
    await auditRepo.record({ userId, email, portal, action, success: false, ...meta });
    throw new AppError(401, 'Invalid credentials');
  };

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    return fail('login_failed');
  }

  const isLocked = user.locked_until && user.locked_until > new Date();
  if (!user.is_active || isLocked) {
    await bcrypt.compare(password, DUMMY_HASH);
    return fail(user.is_active ? 'login_blocked_locked' : 'login_blocked_inactive', user.id);
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    const rule = lockRuleFor(user.role);
    await userRepo.registerFailedLogin(user.id, rule.maxAttempts, rule.lockMinutes);
    return fail('login_failed', user.id);
  }

  // Right password, but is this the right portal? The role in the
  // database decides, never the tab.
  if (!canUsePortal(user.role, portal)) {
    return fail('login_portal_mismatch', user.id);
  }

  await userRepo.resetLoginState(user.id);
  const session = await issueSession(user, portal);

  await auditRepo.record({
    userId: user.id,
    email,
    portal,
    action: 'login_success',
    success: true,
    ...meta,
  });

  return { user: userRepo.toPublicUser(user), ...session };
}

// Swap a valid refresh token for a new pair (rotation: each token works once)
export async function refreshSession(rawToken, meta) {
  const deny = () => {
    throw new AppError(401, 'Authentication required');
  };
  if (!rawToken) return deny();

  const tokenHash = hashToken(rawToken);
  const consumed = await refreshRepo.consume(tokenHash);

  if (!consumed) {
    // Unknown, expired, or ALREADY USED. If it was already used, someone may
    // have copied it, so revoke every session for that user to be safe.
    const old = await refreshRepo.findByHash(tokenHash);
    if (old && old.revoked_at) {
      await refreshRepo.revokeAllForUser(old.user_id);
      await auditRepo.record({
        userId: old.user_id,
        portal: old.portal,
        action: 'refresh_reuse_detected',
        success: false,
        ...meta,
      });
    }
    return deny();
  }

  const user = await userRepo.findById(consumed.user_id);
  if (!user || !user.is_active || !canUsePortal(user.role, consumed.portal)) {
    await refreshRepo.revokeAllForUser(consumed.user_id);
    return deny();
  }

  const session = await issueSession(user, consumed.portal);
  return { user: userRepo.toPublicUser(user), portal: consumed.portal, ...session };
}

export async function logout(rawToken, meta) {
  if (!rawToken) return;
  const revoked = await refreshRepo.revokeByHash(hashToken(rawToken));
  if (revoked) {
    await auditRepo.record({
      userId: revoked.user_id,
      portal: revoked.portal,
      action: 'logout',
      success: true,
      ...meta,
    });
  }
}