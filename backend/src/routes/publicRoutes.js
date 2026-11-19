import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicLimiter } from '../middleware/rateLimiters.js';
import * as analytics from '../controllers/analyticsController.js';
import * as alerts from '../controllers/alertController.js';
const router = Router();

router.get('/transparency', publicLimiter, asyncHandler(analytics.transparency));
router.get('/alerts', publicLimiter, asyncHandler(alerts.active));
export default router;