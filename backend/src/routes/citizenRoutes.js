import { Router } from 'express';
import { uploadPhoto } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { reportLimiter } from '../middleware/rateLimiters.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createIssueSchema } from '../validators/issueSchemas.js';
import * as issues from '../controllers/issueController.js';

const router = Router();

router.get('/ping', (req, res) => {
  res.json({ message: 'citizen area', user: req.auth.user });
});

router.get('/issues', asyncHandler(issues.listMine));

// Order: rate limit (cheap) -> read the upload -> validate the fields -> controller
router.post('/issues', reportLimiter, uploadPhoto, validate(createIssueSchema), asyncHandler(issues.create));

export default router;