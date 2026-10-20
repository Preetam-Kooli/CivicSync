import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { registerSchema, loginSchema } from '../validators/authSchemas.js';
import * as authController from '../controllers/authController.js';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(authController.register));
router.post('/login', validate(loginSchema), asyncHandler(authController.login));

export default router;