import crypto from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { runMaintenance } from '../services/maintenanceService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Hash both sides so the comparison is constant-time and length-safe
const digest = (v) => crypto.createHash('sha256').update(String(v)).digest();

router.post(
  '/maintenance',
  asyncHandler(async (req, res) => {
    const given = req.get('x-cron-secret') || '';
    if (!crypto.timingSafeEqual(digest(given), digest(env.cronSecret))) {
      throw new AppError(401, 'Unauthorized');
    }
    res.json({ result: await runMaintenance('external') });
  })
);

export default router;