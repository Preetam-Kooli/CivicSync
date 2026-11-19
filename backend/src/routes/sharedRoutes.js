import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as issues from '../controllers/issueController.js';
import * as alerts from '../controllers/alertController.js';
const router = Router();

router.get('/categories', asyncHandler(issues.categories));
router.get('/map', asyncHandler(issues.mapData));

router.get('/flood-zones', asyncHandler(alerts.zonesGeo));
export default router;