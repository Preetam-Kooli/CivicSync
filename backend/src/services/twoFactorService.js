import * as userRepo from '../repositories/userRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/AppError.js';
import { verifyChallengeToken } from '../utils/tokens.js';
import { encrypt, decrypt } from '../utils/secretBox.js';
import { generateSecret, buildEnrollment, checkCode } from '../utils/totp.js';
import { canUsePortal } from '../config/portals.js';
import { issueSession, lockRuleFor } from './authService.js';

const sessionExpired = () => new AppError(401, 'Session expired. Please log in again.');
const badCode = () => new AppError(401, 'Invalid or expired code');

// Turns the challenge token (from the password step) back into a user
async function userFromChallenge(challengeToken) {
  let payload;
  try {
    payload = verifyChallengeToken(challengeToken);
  } catch {
    throw sessionExpired();
  }
  const user = await userRepo.findById(payload.sub);
  const locked = user?.locked_until && user.locked_until > new Date();
  if (!user || !user.is_active || locked || !canUsePortal(user.role, 'admin')) {
    throw sessionExpired();
  }
  return user;
}

// First-time setup: make a secret, store it ENCRYPTED, return the QR code
export async function startSetup(challengeToken) {
  const user = await userFromChallenge(challengeToken);
  if (user.totp_enabled) {
    throw new AppError(409, 'Two-factor authentication is already set up');
  }
  const secret = generateSecret();
  await userRepo.setPendingTotpSecret(user.id, encrypt(secret));
  return buildEnrollment(secret, user.email);
}

// Checks a 6-digit code. During setup, a correct code switches 2FA on.
// Either way, a correct code finishes the login and issues the session.
export async function verify({ challengeToken, code }, meta) {
  const user = await userFromChallenge(challengeToken);
  if (!user.totp_secret) {
    throw new AppError(400, 'Set up your authenticator app first');
  }
  const settingUp = !user.totp_enabled;

  const fail = async (action) => {
    await auditRepo.record({
      userId: user.id, email: user.email, portal: 'admin', action, success: false, ...meta,
    });
    throw badCode();
  };

  const step = checkCode(decrypt(user.totp_secret), code);

  if (step === null) {
    // Wrong codes count toward the lockout, like wrong passwords
    const rule = lockRuleFor(user.role);
    await userRepo.registerFailedLogin(user.id, rule.maxAttempts, rule.lockMinutes);
    return fail('totp_failed');
  }

  // Replay protection: each 30-second step can be used only once
  if (!(await userRepo.claimTotpStep(user.id, step))) {
    return fail('totp_replayed');
  }

  if (settingUp) await userRepo.enableTotp(user.id);
  await userRepo.resetLoginState(user.id);
  const session = await issueSession(user, 'admin');

  await auditRepo.record({
    userId: user.id,
    email: user.email,
    portal: 'admin',
    action: settingUp ? 'totp_setup_completed' : 'login_success_2fa',
    success: true,
    ...meta,
  });

  return { user: userRepo.toPublicUser(user), ...session };
}