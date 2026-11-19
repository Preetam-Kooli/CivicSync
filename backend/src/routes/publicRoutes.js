import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicLimiter } from '../middleware/rateLimiters.js';
import * as analytics from '../controllers/analyticsController.js';

const router = Router();

router.get('/transparency', publicLimiter, asyncHandler(analytics.transparency));

export default router;