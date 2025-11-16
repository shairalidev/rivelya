import { Router } from 'express';
import Joi from 'joi';
import { Master } from '../models/master.model.js';
import { MasterAvailability } from '../models/master-availability.model.js';
import { Booking } from '../models/booking.model.js';
import { computeMonthAvailability } from '../utils/availability.js';

const router = Router();

const monthSchema = Joi.object({
  year: Joi.number().integer().min(2024).required(),
  month: Joi.number().integer().min(1).max(12).required()
});

// GET /catalog?category=cartomancy-divination&online=true&sort=rating
router.get('/', async (req, res, next) => {
  try {
    const { category, online, sort } = req.query;
    const q = { is_accepting_requests: { $ne: false } };
    if (category) q.categories = category;
    if (online === 'true') q.availability = 'online';

    let cursor = Master.find(q).select(
      'media.avatar_url display_name headline bio categories languages specialties experience_years '
        + 'rate_chat_cpm rate_voice_cpm rate_chat_voice_cpm services availability working_hours kpis is_accepting_requests'
    );
    if (sort === 'rating') cursor = cursor.sort({ 'kpis.avg_rating': -1 });
    if (sort === 'priceAsc') cursor = cursor.sort({ rate_chat_cpm: 1 });

    const list = await cursor.limit(50);
    res.json(list);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const master = await Master.findById(req.params.id);
    if (!master || master.is_accepting_requests === false) {
      return res.status(404).json({ message: 'Master not found' });
    }
    res.json(master);
  } catch (e) { next(e); }
});

router.get('/:id/availability', async (req, res, next) => {
  try {
    const master = await Master.findById(req.params.id).select('_id is_accepting_requests working_hours');
    if (!master || master.is_accepting_requests === false) {
      return res.status(404).json({ message: 'Master not found' });
    }

    const params = await monthSchema.validateAsync({
      year: Number(req.query.year) || new Date().getFullYear(),
      month: Number(req.query.month) || (new Date().getMonth() + 1)
    });

    const availability = await MasterAvailability.findOne({
      master_id: master._id,
      year: params.year,
      month: params.month
    });

    const startDate = `${params.year}-${String(params.month).padStart(2, '0')}-01`;
    const lastDay = new Date(params.year, params.month, 0).getDate();
    const endDate = `${params.year}-${String(params.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const bookings = await Booking.find({
      master_id: master._id,
      date: { $gte: startDate, $lte: endDate },
      status: { $in: ['awaiting_master', 'confirmed'] }
    }).select('date start_time end_time status channel');

    const monthData = computeMonthAvailability({
      year: params.year,
      month: params.month,
      blocks: availability?.blocks || [],
      bookings,
      workingHours: master.working_hours
    });

    res.json({
      year: params.year,
      month: params.month,
      days: monthData.days.map(day => ({
        date: day.date,
        weekday: day.weekday,
        availableRanges: day.availableRanges,
        fullDayBlocked: day.fullDayBlocked,
        blocked: day.blocks.map(block => ({
          id: block._id,
          fullDay: block.full_day,
          start: block.start,
          end: block.end
        })),
        bookings: day.bookings.map(entry => ({
          start: entry.start,
          end: entry.end,
          status: entry.status,
          channel: entry.channel
        }))
      }))
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Invalid month parameters' });
    }
    next(error);
  }
});

export default router;
