import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { canUsePortal } from '../config/portals.js';
import * as userRepo from '../repositories/userRepository.js';

// Every failure gives the same message, so attackers learn nothing
const unauthorized = () => new AppError(401, 'Authentication required');

export const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.access_token;
  if (!token) throw unauthorized();

  let payload;
  try {
    // Pinning the algorithm blocks "alg: none" and algorithm-swap tricks
    payload = jwt.verify(token, env.jwtAccessSecret, { algorithms: ['HS256'] });
  } catch {
    throw unauthorized(); // expired, tampered, or malformed
  }

  // The token says who the user WAS when it was issued. Check they still are.
  const user = await userRepo.findById(payload.sub);
  if (
    !user ||
    !user.is_active ||
    user.role !== payload.role ||
    !canUsePortal(user.role, payload.portal)
  ) {
    throw unauthorized();
  }

  req.auth = {
    userId: user.id,
    role: user.role,
    portal: payload.portal,
    user: userRepo.toPublicUser(user),
  };
  next();
});