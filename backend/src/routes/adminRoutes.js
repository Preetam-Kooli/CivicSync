import { Router } from 'express';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.get('/ping', (req, res) => {
  res.json({ message: 'admin area', user: req.auth.user });
});

// Shows role-level protection: even admins are refused here
router.get('/super-only', authorize('super_admin'), (req, res) => {
  res.json({ message: 'super admin only', user: req.auth.user });
});

export default router;