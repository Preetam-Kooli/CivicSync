import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { openDataLimiter } from '../middleware/rateLimiters.js';
import * as analytics from '../controllers/analyticsController.js';

const router = Router();

// CORS: lets OTHER websites' JavaScript read this API. Safe here because it is read-only,
// anonymous and sends no cookies. The rest of the API sends no CORS headers at all.
router.use((req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

router.use(openDataLimiter);
router.get('/issues', asyncHandler(analytics.openIssues));
router.get('/categories', asyncHandler(analytics.openCategories));
router.get('/stats/monthly', asyncHandler(analytics.openMonthly));
router.get('/openapi.json', analytics.openApi);

export default router;