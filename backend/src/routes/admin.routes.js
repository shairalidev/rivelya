import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Master } from '../models/master.model.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.post('/masters/:id/freeze', async (req, res, next) => {
  try {
    const m = await Master.findByIdAndUpdate(req.params.id, { status: 'suspended' }, { new: true });
    res.json(m);
  } catch (e) { next(e); }
});

export default router;
