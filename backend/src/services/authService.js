import bcrypt from 'bcryptjs';
import * as userRepo from '../repositories/userRepository.js';
import * as refreshRepo from '../repositories/refreshTokenRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/AppError.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  REFRESH_TTL_DAYS,
} from '../utils/tokens.js';

// Cost 10 means 2^10 rounds of hashing: slow enough to frustrate
// attackers, fast enough that users don't notice.
const BCRYPT_COST = 10;

// Which database roles may sign in through which tab
const PORTAL_ROLES = {
  citizen: ['citizen', 'volunteer'],
  admin: ['staff', 'admin', 'super_admin'],
};

// Stricter lockout for accounts with admin-side roles
const LOCK_RULES = {
  citizen: { maxAttempts: 5, lockMinutes: 15 },
  admin: { maxAttempts: 3, lockMinutes: 30 },
};
const lockRuleFor = (role) =>
  PORTAL_ROLES.admin.includes(role) ? LOCK_RULES.admin : LOCK_RULES.citizen;

// Used when the email doesn't exist, so that case takes as long as a real
// password check. Without it, attackers could time the responses to discover
// which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

export async function registerCitizen({ fullName, email, phone, password }) {
  const existing = await userRepo.findByEmail(email);
  if (existing) {
    throw new AppError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  try {
    return await userRepo.createCitizen({ fullName, email, phone, passwordHash });
  } catch (err) {
    // 23505 is PostgreSQL's "unique violation" code (two people registering
    // the same email at the same instant).
    if (err.code === '23505') {
      throw new AppError(409, 'An account with this email already exists');
    }
    throw err;
  }
}

export async function login({ email, password, portal }, meta) {
  const user = await userRepo.findByEmail(email);

  // Records the failure in the audit log, then throws the SAME generic error
  // for every kind of failure.
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

  // The password is right, but is this the right portal for this account?
  // The tab is only a request. The role stored in the database decides.
  if (!PORTAL_ROLES[portal].includes(user.role)) {
    return fail('login_portal_mismatch', user.id);
  }

  // Success
  await userRepo.resetLoginState(user.id);

  const accessToken = signAccessToken(user, portal);
  const refreshToken = generateRefreshToken();
  await refreshRepo.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    portal,
    expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
  });

  await auditRepo.record({
    userId: user.id,
    email,
    portal,
    action: 'login_success',
    success: true,
    ...meta,
  });

  return { user: userRepo.toPublicUser(user), accessToken, refreshToken };
}