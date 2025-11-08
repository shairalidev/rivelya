import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Review } from '../models/review.model.js';
import { Session } from '../models/session.model.js';

const router = Router();

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { session_id, rating, text } = req.body;
    const sess = await Session.findById(session_id);
    if (!sess || String(sess.user_id) !== String(req.user._id) || sess.status !== 'ended') {
      return res.status(400).json({ message: 'Not eligible' });
    }
    const review = await Review.create({ session_id, rating, text });
    res.json(review);
  } catch (e) { next(e); }
});

export default router;
