import * as userRepo from '../repositories/userRepository.js';
import * as refreshRepo from '../repositories/refreshTokenRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/AppError.js';
import { PORTAL_ROLES } from '../config/portals.js';

export async function list() {
  const rows = await userRepo.listAll();
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    role: r.role,
    department: r.department,
    isActive: r.is_active,
    totpEnabled: r.totp_enabled,
    isLocked: r.is_locked,
    createdAt: r.created_at,
  }));
}

async function getTarget(id) {
  const target = await userRepo.findById(id);
  if (!target) throw new AppError(404, 'User not found');
  return target;
}

export async function setActive(id, active, actor, meta) {
  if (!active && String(id) === String(actor.userId)) {
    throw new AppError(400, 'You cannot deactivate your own account');
  }
  const target = await getTarget(id);
  await userRepo.setActive(id, active);
  // Deactivating also ends every session. (The access token stops working at
  // once too, because authenticate() re-checks is_active on every request.)
  if (!active) await refreshRepo.revokeAllForUser(id);

  await auditRepo.record({
    userId: actor.userId,
    email: target.email,
    portal: 'admin',
    action: active ? 'user_activated' : 'user_deactivated',
    success: true,
    ...meta,
  });
}

export async function resetTwoFactor(id, actor, meta) {
  const target = await getTarget(id);
  if (!PORTAL_ROLES.admin.includes(target.role)) {
    throw new AppError(400, 'Only admin-side accounts use two-factor authentication');
  }
  await userRepo.resetTotp(id);
  await refreshRepo.revokeAllForUser(id);

  await auditRepo.record({
    userId: actor.userId, email: target.email, portal: 'admin', action: 'totp_reset', success: true, ...meta,
  });
}