import { Router } from 'express';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createInviteSchema } from '../validators/adminSchemas.js';
import * as admin from '../controllers/adminController.js';
import * as issueCtl from '../controllers/issueController.js';
import { uploadPhoto } from '../middleware/upload.js';
import { transitionSchema } from '../validators/issueSchemas.js';
import * as analytics from '../controllers/analyticsController.js';
import * as alertCtl from '../controllers/alertController.js';
import { createAlertSchema } from '../validators/alertSchemas.js';
import { weatherCheckLimiter } from '../middleware/rateLimiters.js';

const router = Router();
const superOnly = authorize('super_admin');

router.get('/ping', (req, res) => {
  res.json({ message: 'admin area', user: req.auth.user });
});

router.get('/super-only', superOnly, (req, res) => {
  res.json({ message: 'super admin only', user: req.auth.user });
});

router.get('/invites', superOnly, asyncHandler(admin.listInvites));
router.post('/invites', superOnly, validate(createInviteSchema), asyncHandler(admin.createInvite));
router.delete('/invites/:id', superOnly, asyncHandler(admin.revokeInvite));

router.get('/users', superOnly, asyncHandler(admin.listUsers));
router.post('/users/:id/deactivate', superOnly, asyncHandler(admin.deactivateUser));
router.post('/users/:id/activate', superOnly, asyncHandler(admin.activateUser));
router.post('/users/:id/reset-2fa', superOnly, asyncHandler(admin.resetUserTwoFactor));

router.get('/issues', asyncHandler(issueCtl.adminList));
router.get('/issues/:id', asyncHandler(issueCtl.adminDetail));
router.post('/issues/:id/transition', uploadPhoto, validate(transitionSchema), asyncHandler(issueCtl.adminTransition));
router.get('/analytics', asyncHandler(analytics.adminAnalytics));
router.get('/hotspots', asyncHandler(analytics.hotspots));

const notStaff = authorize('admin', 'super_admin');
router.get('/alerts', notStaff, asyncHandler(alertCtl.listRecent));
router.post('/alerts', notStaff, validate(createAlertSchema), asyncHandler(alertCtl.create));
router.post('/alerts/:id/withdraw', notStaff, asyncHandler(alertCtl.withdraw));
router.get('/flood-zones', notStaff, asyncHandler(alertCtl.listZones));
router.post('/weather/check', notStaff, weatherCheckLimiter, asyncHandler(alertCtl.checkNow));


router.get('/summary', asyncHandler(analytics.summary));
router.get('/reports', asyncHandler(analytics.reports));
router.get('/issue-list', asyncHandler(issueCtl.adminListPaged));
export default router;