import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { registerSchema } from '../validators/authSchemas.js';
import * as authController from '../controllers/authController.js';

const router = Router();

// Order matters: validate first, then the controller
router.post('/register', validate(registerSchema), asyncHandler(authController.register));

export default router;