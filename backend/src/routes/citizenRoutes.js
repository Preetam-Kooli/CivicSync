import { Router } from 'express';

const router = Router();

// A placeholder so we can test the protection. Real citizen routes come in Phase 3+.
router.get('/ping', (req, res) => {
  res.json({ message: 'citizen area', user: req.auth.user });
});

export default router;