import { Router } from 'express';
import Joi from 'joi';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Master } from '../models/master.model.js';
import { MasterAvailability } from '../models/master-availability.model.js';
import { Booking } from '../models/booking.model.js';
import { computeMonthAvailability } from '../utils/availability.js';
import { getPublicDisplayName } from '../utils/privacy.js';

const router = Router();

const monthSchema = Joi.object({
  year: Joi.number().integer().min(2024).required(),
  month: Joi.number().integer().min(1).max(12).required()
});

const blockSchema = Joi.object({
  year: Joi.number().integer().min(2024).required(),
  month: Joi.number().integer().min(1).max(12).required(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  fullDay: Joi.boolean().default(false),
  start: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null),
  end: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null)
});

const ensureMasterAccount = async userId => {
  const master = await Master.findOne({ user_id: userId }).select('_id display_name working_hours');
  return master;
};

const loadMonth = async ({ masterId, year, month, workingHours }) => {
  const availability = await MasterAvailability.findOne({ master_id: masterId, year, month });
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const bookings = await Booking.find({
    master_id: masterId,
    date: { $gte: startDate, $lte: endDate }
  }).populate('customer_id', 'display_name first_name last_name email');

  const blockingStatuses = new Set(['awaiting_master', 'confirmed', 'ready_to_start', 'active', 'reschedule_requested']);
  const bookingsForAvailability = bookings.filter(booking => blockingStatuses.has(booking.status));

  const monthData = computeMonthAvailability({
    year,
    month,
    blocks: availability?.blocks || [],
    bookings: bookingsForAvailability,
    workingHours
  });

  const serializeBooking = booking => ({
    id: booking._id,
    date: booking.date,
    start: booking.start_time,
    end: booking.end_time,
    status: booking.status,
    channel: booking.channel,
    amount_cents: booking.amount_cents,
    customer: booking.customer_id
      ? {
          id: booking.customer_id._id,
          name: getPublicDisplayName(booking.customer_id, 'Cliente')
        }
      : null
  });

  const serialized = bookings.map(serializeBooking);
  const bookingsByDate = serialized.reduce((acc, booking) => {
    if (!acc[booking.date]) acc[booking.date] = [];
    acc[booking.date].push(booking);
    return acc;
  }, {});

  return {
    blocks: monthData.blocks,
    days: monthData.days.map(day => ({
      ...day,
      bookings: bookingsByDate[day.date] || []
    }))
  };
};

router.get('/month', requireAuth, requireRole('master'), async (req, res, next) => {
  try {
    const params = await monthSchema.validateAsync({
      year: Number(req.query.year) || new Date().getFullYear(),
      month: Number(req.query.month) || (new Date().getMonth() + 1)
    });

    const master = await ensureMasterAccount(req.user._id);
    if (!master) return res.status(404).json({ message: 'Profilo master non trovato.' });

    const payload = await loadMonth({ masterId: master._id, workingHours: master.working_hours, ...params });
    res.json({
      year: params.year,
      month: params.month,
      ...payload
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Parametri non validi' });
    }
    next(error);
  }
});

router.post('/block', requireAuth, requireRole('master'), async (req, res, next) => {
  try {
    const payload = await blockSchema.validateAsync(req.body);
    const { year, month, date, fullDay, start, end } = payload;

    const master = await ensureMasterAccount(req.user._id);
    if (!master) return res.status(404).json({ message: 'Profilo master non trovato.' });

    const [dYear, dMonth] = date.split('-').map(Number);
    if (dYear !== year || dMonth !== month) {
      return res.status(400).json({ message: 'La data selezionata non appartiene al mese indicato.' });
    }

    if (!fullDay && (!start || !end)) {
      return res.status(400).json({ message: 'Specificare orario di inizio e fine.' });
    }

    const record = await MasterAvailability.findOneAndUpdate(
      { master_id: master._id, year, month },
      { $setOnInsert: { blocks: [] } },
      { new: true, upsert: true }
    );

    record.blocks.push({
      date,
      full_day: fullDay,
      start: fullDay ? undefined : start,
      end: fullDay ? undefined : end
    });
    await record.save();

    const monthData = await loadMonth({ masterId: master._id, year, month, workingHours: master.working_hours });
    res.status(201).json({
      year,
      month,
      ...monthData
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Dati non validi.' });
    }
    next(error);
  }
});

router.delete('/block/:blockId', requireAuth, requireRole('master'), async (req, res, next) => {
  try {
    const params = await monthSchema.validateAsync({
      year: Number(req.query.year) || new Date().getFullYear(),
      month: Number(req.query.month) || (new Date().getMonth() + 1)
    });

    const master = await ensureMasterAccount(req.user._id);
    if (!master) return res.status(404).json({ message: 'Profilo master non trovato.' });

    await MasterAvailability.updateOne(
      { master_id: master._id, year: params.year, month: params.month },
      { $pull: { blocks: { _id: req.params.blockId } } }
    );

    const monthData = await loadMonth({
      masterId: master._id,
      year: params.year,
      month: params.month,
      workingHours: master.working_hours
    });
    res.json({
      year: params.year,
      month: params.month,
      ...monthData
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Parametri non validi.' });
    }
    next(error);
  }
});

export default router;
