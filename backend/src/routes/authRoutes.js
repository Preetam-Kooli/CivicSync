import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  registerLimiter,
  loginLimiter,
  refreshLimiter,
  twoFactorLimiter,
  inviteLimiter,
} from '../middleware/rateLimiters.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  registerSchema,
  loginSchema,
  challengeSchema,
  twoFactorVerifySchema,
  inviteTokenSchema,
  inviteAcceptSchema,
} from '../validators/authSchemas.js';
import * as authController from '../controllers/authController.js';

const router = Router();

router.post('/register', registerLimiter, validate(registerSchema), asyncHandler(authController.register));
router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post('/refresh', refreshLimiter, asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', authenticate, authController.me);

// Admin second step
router.post('/2fa/setup', twoFactorLimiter, validate(challengeSchema), asyncHandler(authController.twoFactorSetup));
router.post('/2fa/verify', twoFactorLimiter, validate(twoFactorVerifySchema), asyncHandler(authController.twoFactorVerify));

// Invitation links (public, because the invitee has no account yet)
router.post('/invite/inspect', inviteLimiter, validate(inviteTokenSchema), asyncHandler(authController.inviteInspect));
router.post('/invite/accept', inviteLimiter, validate(inviteAcceptSchema), asyncHandler(authController.inviteAccept));

export default router;