import bcrypt from 'bcryptjs';
import * as userRepo from '../repositories/userRepository.js';
import * as refreshRepo from '../repositories/refreshTokenRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/AppError.js';
import { hashPassword, issueSession } from './authService.js';

export async function updateProfile(userId, { fullName, phone }) {
  const row = await userRepo.updateProfile(userId, { fullName, phone: phone || null });
  if (!row) throw new AppError(404, 'Account not found');
  return userRepo.toPublicUser(row);
}

export async function changePassword(auth, { currentPassword, newPassword }, meta) {
  const user = await userRepo.findById(auth.userId);
  const ok = user && (await bcrypt.compare(currentPassword, user.password_hash));
  if (!ok) {
    await auditRepo.record({ userId: auth.userId, portal: auth.portal, action: 'password_change_failed', success: false, ...meta });
    throw new AppError(400, 'Your current password is not correct'); // 400, not 401: a 401 would make the app try to refresh the session
  }
  if (await bcrypt.compare(newPassword, user.password_hash)) {
    throw new AppError(400, 'Choose a password that is different from the current one');
  }
  await userRepo.updatePasswordHash(user.id, await hashPassword(newPassword));
  await refreshRepo.revokeAllForUser(user.id); // every other device is signed out
  const session = await issueSession(user, auth.portal); // this device stays signed in
  await auditRepo.record({ userId: user.id, portal: auth.portal, action: 'password_changed', success: true, ...meta });
  return session;
}

export async function logoutAll(auth, meta) {
  await refreshRepo.revokeAllForUser(auth.userId);
  await auditRepo.record({ userId: auth.userId, portal: auth.portal, action: 'logout_all', success: true, ...meta });
}