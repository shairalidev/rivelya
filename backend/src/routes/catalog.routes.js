import { Router } from 'express';
import Joi from 'joi';
import { Master } from '../models/master.model.js';
import { MasterAvailability } from '../models/master-availability.model.js';
import { Booking } from '../models/booking.model.js';
import { Session } from '../models/session.model.js';
import { Review } from '../models/review.model.js';
import { ChatThread } from '../models/chat-thread.model.js';
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
    // Rating sort will be handled after getting review data
    if (sort === 'priceAsc') cursor = cursor.sort({ rate_chat_cpm: 1 });

    const masters = await cursor.limit(50).lean();

    const masterIds = masters.map(master => master._id);
    const masterUserIds = masters.map(master => master.user_id).filter(Boolean);
    
    // Get active sessions
    const activeSessions = await Session.find({
      master_id: { $in: masterIds },
      status: 'active',
      start_ts: { $ne: null }
    }).select('master_id channel').lean();

    const sessionsByMaster = new Map();
    activeSessions.forEach(session => {
      sessionsByMaster.set(String(session.master_id), session.channel);
    });

    // Calculate real-time review statistics
    const reviewStats = await Review.aggregate([
      {
        $match: {
          reviewee_id: { $in: masterUserIds },
          reviewer_type: 'client'
        }
      },
      {
        $group: {
          _id: '$reviewee_id',
          avg_rating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    const reviewsByUserId = new Map();
    reviewStats.forEach(stat => {
      reviewsByUserId.set(String(stat._id), {
        avg_rating: Math.round(stat.avg_rating * 10) / 10,
        count: stat.count
      });
    });

    // Calculate real-time session counts
    const sessionStats = await Session.aggregate([
      {
        $match: {
          master_id: { $in: masterIds },
          status: 'ended'
        }
      },
      {
        $group: {
          _id: { master_id: '$master_id', channel: '$channel' },
          count: { $sum: 1 }
        }
      }
    ]);

    const chatThreadStats = await ChatThread.aggregate([
      {
        $match: {
          master_id: { $in: masterIds },
          status: 'expired'
        }
      },
      {
        $group: {
          _id: '$master_id',
          count: { $sum: 1 }
        }
      }
    ]);

    const sessionsByMasterId = new Map();
    sessionStats.forEach(stat => {
      const masterId = String(stat._id.master_id);
      if (!sessionsByMasterId.has(masterId)) {
        sessionsByMasterId.set(masterId, { voice: 0, chat: 0 });
      }
      if (stat._id.channel === 'voice' || stat._id.channel === 'chat_voice') {
        sessionsByMasterId.get(masterId).voice += stat.count;
      }
    });

    chatThreadStats.forEach(stat => {
      const masterId = String(stat._id);
      if (!sessionsByMasterId.has(masterId)) {
        sessionsByMasterId.set(masterId, { voice: 0, chat: 0 });
      }
      sessionsByMasterId.get(masterId).chat += stat.count;
    });

    let list = masters.map(master => {
      const sessions = sessionsByMasterId.get(String(master._id)) || { voice: 0, chat: 0 };
      return {
        ...master,
        active_session: sessionsByMaster.has(String(master._id)),
        active_session_channel: sessionsByMaster.get(String(master._id)) || null,
        reviews: reviewsByUserId.get(String(master.user_id)) || { avg_rating: 0, count: 0 },
        sessions: sessions
      };
    });

    // Sort by rating if requested (now that we have real-time data)
    if (sort === 'rating') {
      list = list.sort((a, b) => (b.reviews.avg_rating || 0) - (a.reviews.avg_rating || 0));
    }

    res.json(list);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const master = await Master.findById(req.params.id).lean();
    if (!master || master.is_accepting_requests === false) {
      return res.status(404).json({ message: 'Master not found' });
    }
    
    // Get real-time review statistics
    const reviewStats = await Review.aggregate([
      {
        $match: {
          reviewee_id: master.user_id,
          reviewer_type: 'client'
        }
      },
      {
        $group: {
          _id: null,
          avg_rating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const reviews = reviewStats.length > 0 ? {
      avg_rating: Math.round(reviewStats[0].avg_rating * 10) / 10,
      count: reviewStats[0].count
    } : { avg_rating: 0, count: 0 };
    
    // Calculate session counts
    const [voiceSessions, chatSessions] = await Promise.all([
      Session.countDocuments({ master_id: master._id, status: 'ended', channel: { $in: ['voice', 'chat_voice'] } }),
      ChatThread.countDocuments({ master_id: master._id, status: 'expired' })
    ]);
    
    const sessions = { voice: voiceSessions, chat: chatSessions };
    
    res.json({ ...master, reviews, sessions });
  } catch (e) { next(e); }
});

// POST /catalog/:id/view - Track profile view
router.post('/:id/view', async (req, res, next) => {
  try {
    const master = await Master.findById(req.params.id);
    if (!master) {
      return res.status(404).json({ message: 'Master not found' });
    }
    
    // Increment profile views
    await Master.findByIdAndUpdate(req.params.id, {
      $inc: { 'kpis.profile_views': 1 }
    });
    
    res.json({ success: true });
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
