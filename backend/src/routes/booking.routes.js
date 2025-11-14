import { Router } from 'express';
import Joi from 'joi';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Master } from '../models/master.model.js';
import { MasterAvailability } from '../models/master-availability.model.js';
import { Booking } from '../models/booking.model.js';
import { ChatThread } from '../models/chat-thread.model.js';
import { Wallet } from '../models/wallet.model.js';
import { Transaction } from '../models/transaction.model.js';
import { checkAvailability } from '../utils/availability.js';
import { createNotification } from '../utils/notifications.js';
import { emitToUser } from '../lib/socket.js';

const router = Router();

const bookingSchema = Joi.object({
  masterId: Joi.string().hex().length(24).required(),
  channel: Joi.string().valid('phone', 'chat', 'video').required(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  start: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  end: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  notes: Joi.string().max(600).allow('', null)
});

const respondSchema = Joi.object({
  action: Joi.string().valid('accept', 'reject').required()
});

const ensureMaster = async userId =>
  Master.findOne({ user_id: userId }).select(
    '_id display_name rate_phone_cpm rate_chat_cpm rate_video_cpm services user_id'
  );

const loadDayContext = async ({ masterId, date }) => {
  const [year, month] = date.split('-').map(Number);
  const availability = await MasterAvailability.findOne({ master_id: masterId, year, month });
  const dayBlocks = (availability?.blocks || []).filter(block => block.date === date);
  const bookings = await Booking.find({
    master_id: masterId,
    date,
    status: { $in: ['awaiting_master', 'confirmed'] }
  });
  return { blocks: dayBlocks, bookings };
};

const serializeMasterRequest = booking => ({
  id: booking._id,
  date: booking.date,
  start: booking.start_time,
  end: booking.end_time,
  channel: booking.channel,
  status: booking.status,
  amount_cents: booking.amount_cents,
  duration_minutes: booking.duration_minutes,
  notes: booking.notes || '',
  customer: booking.customer_id
    ? {
        id: booking.customer_id._id,
        name:
          booking.customer_id.display_name
          || [booking.customer_id.first_name, booking.customer_id.last_name].filter(Boolean).join(' ')
          || 'Cliente riservato',
        phone: booking.customer_id.phone || '',
        emailAvailable: Boolean(booking.customer_id.email)
      }
    : null
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const payload = await bookingSchema.validateAsync(req.body);
    const master = await Master.findById(payload.masterId);
    if (!master) return res.status(404).json({ message: 'Master non trovato.' });

    const user = req.user;
    if (!user.wallet_id) {
      return res.status(400).json({ message: 'Wallet non disponibile.' });
    }

    const { blocks, bookings } = await loadDayContext({ masterId: master._id, date: payload.date });
    const slotIsFree = checkAvailability({ blocks, bookings, start: payload.start, end: payload.end });
    if (!slotIsFree) {
      return res.status(409).json({ message: 'La fascia oraria selezionata non è disponibile.' });
    }

    const startMinutes = Number(payload.start.split(':')[0]) * 60 + Number(payload.start.split(':')[1]);
    const endMinutes = Number(payload.end.split(':')[0]) * 60 + Number(payload.end.split(':')[1]);
    const durationMinutes = endMinutes - startMinutes;
    if (durationMinutes <= 0) {
      return res.status(400).json({ message: 'Durata non valida.' });
    }

    const services = master.services || {};
    if (payload.channel === 'video') {
      if (!services.video) {
        return res.status(400).json({ message: 'Il master non offre questo canale al momento.' });
      }
    } else if (services[payload.channel] === false) {
      return res.status(400).json({ message: 'Il master non offre questo canale al momento.' });
    }

    const rate = (() => {
      if (payload.channel === 'phone') return master.rate_phone_cpm;
      if (payload.channel === 'video') return master.rate_video_cpm;
      return master.rate_chat_cpm;
    })();
    const amount = durationMinutes * rate;
    if (amount <= 0) {
      return res.status(400).json({ message: 'Impossibile calcolare il costo della sessione.' });
    }

    const wallet = await Wallet.findById(user.wallet_id);
    if (!wallet) {
      return res.status(400).json({ message: 'Wallet non disponibile.' });
    }

    if (wallet.balance_cents < amount) {
      return res.status(402).json({
        message: 'Credito insufficiente. Ricarica il wallet per completare la prenotazione.',
        code: 'INSUFFICIENT_FUNDS',
        required_cents: amount - wallet.balance_cents
      });
    }

    wallet.balance_cents -= amount;
    const txn = await Transaction.create({
      wallet_id: wallet._id,
      type: 'spend',
      amount: -amount,
      meta: {
        booking: payload.date,
        master: master.display_name,
        channel: payload.channel,
        start: payload.start,
        end: payload.end
      }
    });
    await wallet.save();

    const booking = await Booking.create({
      master_id: master._id,
      customer_id: user._id,
      channel: payload.channel,
      date: payload.date,
      start_time: payload.start,
      end_time: payload.end,
      duration_minutes: durationMinutes,
      amount_cents: amount,
      status: 'awaiting_master',
      wallet_txn_id: txn._id,
      notes: payload.notes || ''
    });

    await createNotification({
      userId: master.user_id,
      type: 'booking:new',
      title: 'Nuova richiesta di prenotazione',
      body: `Hai una nuova richiesta per il ${payload.date} dalle ${payload.start} alle ${payload.end}.`,
      meta: { bookingId: booking._id }
    });

    res.status(201).json({
      booking: {
        id: booking._id,
        status: booking.status,
        date: booking.date,
        start: booking.start_time,
        end: booking.end_time,
        channel: booking.channel,
        amount_cents: booking.amount_cents,
        duration_minutes: booking.duration_minutes
      }
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Dati non validi.' });
    }
    next(error);
  }
});

router.get('/master/requests', requireAuth, requireRole('master'), async (req, res, next) => {
  try {
    const master = await ensureMaster(req.user._id);
    if (!master) return res.status(404).json({ message: 'Profilo master non trovato.' });

    const filter = { master_id: master._id };
    if (req.query.status) filter.status = req.query.status;

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('customer_id', 'display_name first_name last_name email phone');

    res.json({
      requests: bookings.map(serializeMasterRequest)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:bookingId/respond', requireAuth, requireRole('master'), async (req, res, next) => {
  try {
    const { action } = await respondSchema.validateAsync(req.body);
    const master = await ensureMaster(req.user._id);
    if (!master) return res.status(404).json({ message: 'Profilo master non trovato.' });

    const booking = await Booking.findOne({ _id: req.params.bookingId, master_id: master._id })
      .populate('customer_id', 'display_name first_name last_name email phone wallet_id');
    if (!booking) return res.status(404).json({ message: 'Prenotazione non trovata.' });
    if (booking.status !== 'awaiting_master') {
      return res.status(400).json({ message: 'La prenotazione è già stata gestita.' });
    }

    if (action === 'accept') {
      booking.status = 'confirmed';
      await booking.save();

      if (booking.channel === 'chat') {
        const startedAt = new Date();
        const allowedSeconds = Math.max(60, (booking.duration_minutes || 0) * 60);
        const expiresAt = new Date(startedAt.getTime() + allowedSeconds * 1000);
        const thread = await ChatThread.findOneAndUpdate(
          { booking_id: booking._id },
          {
            booking_id: booking._id,
            master_id: master._id,
            master_user_id: master.user_id,
            customer_id: booking.customer_id?._id,
            channel: 'chat',
            allowed_seconds: allowedSeconds,
            started_at: startedAt,
            expires_at: expiresAt,
            status: 'open'
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).populate('booking_id', 'date start_time end_time channel status')
          .populate('master_id', 'display_name')
          .populate('master_user_id', 'display_name first_name last_name email avatar_url')
          .populate('customer_id', 'display_name first_name last_name email avatar_url');

        emitToUser(master.user_id, 'chat:thread:updated', { threadId: thread._id });
        emitToUser(booking.customer_id?._id, 'chat:thread:updated', { threadId: thread._id });
      }

      await createNotification({
        userId: booking.customer_id?._id,
        type: 'booking:accepted',
        title: 'Prenotazione confermata',
        body: `${master.display_name || 'Il master'} ha accettato la tua richiesta per il ${booking.date}.`,
        meta: { bookingId: booking._id }
      });

      return res.json({ booking: serializeMasterRequest(booking) });
    }

    // reject
    booking.status = 'rejected';
    await booking.save();

    if (booking.wallet_txn_id && booking.amount_cents > 0 && booking.customer_id?.wallet_id) {
      const wallet = await Wallet.findById(booking.customer_id.wallet_id);
      if (wallet) {
        wallet.balance_cents += booking.amount_cents;
        await wallet.save();
        await Transaction.create({
          wallet_id: wallet._id,
          type: 'refund',
          amount: booking.amount_cents,
          meta: {
            booking: booking._id,
            master: master.display_name,
            reason: 'Prenotazione rifiutata'
          }
        });
      }
    }

    await createNotification({
      userId: booking.customer_id?._id,
      type: 'booking:rejected',
      title: 'Prenotazione rifiutata',
      body: `${master.display_name || 'Il master'} ha rifiutato la tua richiesta per il ${booking.date}.`,
      meta: { bookingId: booking._id }
    });

    res.json({ booking: serializeMasterRequest(booking) });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Richiesta non valida.' });
    }
    next(error);
  }
});

export default router;
