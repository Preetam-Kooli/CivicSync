import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as issues from '../controllers/issueController.js';

const router = Router();

router.get('/categories', asyncHandler(issues.categories));
router.get('/map', asyncHandler(issues.mapData));

export default router;