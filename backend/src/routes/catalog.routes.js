import { Router } from 'express';
import { Master } from '../models/master.model.js';

const router = Router();

// GET /catalog?category=cartomancy-divination&online=true&sort=rating
router.get('/', async (req, res, next) => {
  try {
    const { category, online, sort } = req.query;
    const q = {};
    if (category) q.categories = category;
    if (online === 'true') q.availability = 'online';

    let cursor = Master.find(q).select('media.avatar_url display_name headline bio categories languages specialties experience_years rate_phone_cpm rate_chat_cpm availability working_hours kpis');
    if (sort === 'rating') cursor = cursor.sort({ 'kpis.avg_rating': -1 });
    if (sort === 'priceAsc') cursor = cursor.sort({ rate_phone_cpm: 1 });

    const list = await cursor.limit(50);
    res.json(list);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const master = await Master.findById(req.params.id);
    if (!master) return res.status(404).json({ message: 'Master not found' });
    res.json(master);
  } catch (e) { next(e); }
});

export default router;
