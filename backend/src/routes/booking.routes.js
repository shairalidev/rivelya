import { Router } from 'express';
import Joi from 'joi';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Master } from '../models/master.model.js';
import { MasterAvailability } from '../models/master-availability.model.js';
import { Booking } from '../models/booking.model.js';
import { ChatThread } from '../models/chat-thread.model.js';
import { Wallet } from '../models/wallet.model.js';
import { Transaction } from '../models/transaction.model.js';
import { Session } from '../models/session.model.js';
import { checkAvailability } from '../utils/availability.js';
import { createNotification } from '../utils/notifications.js';
import { emitToUser } from '../lib/socket.js';
import { notifyVoiceSessionCreated } from '../utils/voice-events.js';

const router = Router();

const bookingSchema = Joi.object({
  masterId: Joi.string().hex().length(24).required(),
  channel: Joi.string().valid('chat', 'voice', 'chat_voice').required(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  start: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  end: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  notes: Joi.string().max(600).allow('', null)
});

const respondSchema = Joi.object({
  action: Joi.string().valid('accept', 'reject').required()
});

const rescheduleSchema = Joi.object({
  newDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  newStart: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  newEnd: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  reason: Joi.string().max(300).allow('', null)
});

const rescheduleResponseSchema = Joi.object({
  action: Joi.string().valid('accept', 'reject').required()
});

const startNowResponseSchema = Joi.object({
  action: Joi.string().valid('accept', 'reject').required()
});

const ensureMaster = async userId =>
  Master.findOne({ user_id: userId }).select(
    '_id display_name rate_chat_cpm rate_voice_cpm rate_chat_voice_cpm services is_accepting_requests user_id working_hours'
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

const startBookingSession = async ({ booking, starterRole, starterName, targetUserId }) => {
  booking.status = 'active';
  booking.started_by = starterRole;
  booking.started_at = new Date();
  booking.can_start = false;
  booking.start_now_request = undefined;
  await booking.save();

  await createNotification({
    userId: targetUserId,
    type: 'session:started',
    title: 'Sessione avviata',
    body: `${starterName} ha avviato la sessione ${booking.reservation_id}. Unisciti ora!`,
    meta: { bookingId: booking._id, reservationId: booking.reservation_id }
  });
};

const emitStartNowEvent = (booking, payload) => {
  if (!booking) return;
  const participants = [booking.customer_id?._id, booking.master_id?.user_id]
    .map(userId => userId?.toString())
    .filter(Boolean);

  participants.forEach(userId => {
    emitToUser(userId, 'booking:start_now', {
      bookingId: booking._id.toString(),
      reservationId: booking.reservation_id,
      ...payload
    });
  });
};

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const payload = await bookingSchema.validateAsync(req.body);
    const master = await Master.findById(payload.masterId);
    if (!master) return res.status(404).json({ message: 'Master non trovato.' });
    if (master.is_accepting_requests === false) {
      return res.status(400).json({ message: 'Il master al momento non accetta nuove richieste.' });
    }

    const user = req.user;
    if (!user.wallet_id) {
      return res.status(400).json({ message: 'Wallet non disponibile.' });
    }

    const { blocks, bookings } = await loadDayContext({ masterId: master._id, date: payload.date });
    const slotIsFree = checkAvailability({
      blocks,
      bookings,
      start: payload.start,
      end: payload.end,
      date: payload.date,
      workingHours: master.working_hours
    });
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
    if (payload.channel === 'chat' && services.chat === false) {
      return res.status(400).json({ message: 'Il master non offre chat al momento.' });
    }
    if (payload.channel === 'voice' && services.voice === false) {
      return res.status(400).json({ message: 'Il master non offre chiamate vocali al momento.' });
    }
    if (payload.channel === 'chat_voice' && services.chat_voice === false) {
      return res.status(400).json({ message: 'Il master non offre chat e voce al momento.' });
    }

    let rate;
    if (payload.channel === 'chat') {
      rate = master.rate_chat_cpm;
    } else if (payload.channel === 'voice') {
      rate = master.rate_voice_cpm;
    } else if (payload.channel === 'chat_voice') {
      rate = master.rate_chat_voice_cpm;
    } else {
      return res.status(400).json({ message: 'Canale non valido.' });
    }
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
    const rejectNotAllowed = ['active', 'completed', 'cancelled', 'rejected'];

    if (action === 'accept') {
      if (booking.status !== 'awaiting_master') {
        return res.status(400).json({ message: 'La prenotazione è già stata gestita.' });
      }
      booking.status = 'ready_to_start';
      booking.can_start = true;
      await booking.save();

      if (booking.channel === 'chat' || booking.channel === 'chat_voice') {
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
            channel: booking.channel,
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

    if (rejectNotAllowed.includes(booking.status)) {
      return res.status(400).json({ message: 'La prenotazione è già stata gestita.' });
    }

    booking.status = 'rejected';
    booking.can_start = false;
    booking.start_now_request = undefined;
    booking.reschedule_request = undefined;
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

router.post('/:bookingId/start-voice', requireAuth, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate('master_id', 'user_id services display_name')
      .populate('customer_id', '_id display_name first_name last_name');
    
    if (!booking) return res.status(404).json({ message: 'Prenotazione non trovata.' });
    if (booking.channel !== 'voice') return res.status(400).json({ message: 'Non è una prenotazione vocale.' });
    if (booking.status !== 'confirmed') return res.status(400).json({ message: 'Prenotazione non confermata.' });
    
    const isCustomer = booking.customer_id._id.toString() === req.user._id.toString();
    const isMaster = booking.master_id.user_id.toString() === req.user._id.toString();
    
    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Non autorizzato.' });
    }

    // Check if master already has an active voice session
    const existingMasterSession = await Session.findOne({
      master_id: booking.master_id._id,
      channel: { $in: ['voice', 'chat_voice'] },
      status: { $in: ['created', 'active'] }
    });
    if (existingMasterSession) {
      return res.status(400).json({ message: 'Il master ha già una sessione vocale attiva.' });
    }

    const now = new Date();
    const durationMs = booking.duration_minutes * 60 * 1000;
    const expiresAt = new Date(now.getTime() + durationMs);
    
    const sess = await Session.create({
      user_id: booking.customer_id._id,
      master_id: booking.master_id._id,
      channel: 'voice',
      price_cpm: booking.amount_cents / booking.duration_minutes,
      status: 'created',
      end_ts: expiresAt,
      booking_id: booking._id
    });

    await notifyVoiceSessionCreated({
      session: sess,
      customerUser: booking.customer_id,
      masterUserId: booking.master_id.user_id
    });

    res.json({
      session_id: sess._id,
      redirect_url: `/voice/${sess._id}`,
      booking_id: booking._id
    });
  } catch (error) {
    next(error);
  }
});

// Get customer bookings with history
router.get('/customer/history', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { customer_id: req.user._id };
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('master_id', 'display_name avatar_url services')
      .populate('wallet_txn_id', 'amount type createdAt');

    const total = await Booking.countDocuments(filter);

    res.json({
      bookings: bookings.map(booking => ({
        id: booking._id,
        master: {
          id: booking.master_id._id,
          name: booking.master_id.display_name,
          avatar: booking.master_id.avatar_url
        },
        date: booking.date,
        start: booking.start_time,
        end: booking.end_time,
        channel: booking.channel,
        status: booking.status,
        amount_cents: booking.amount_cents,
        duration_minutes: booking.duration_minutes,
        notes: booking.notes,
        reschedule_request: booking.reschedule_request,
        reschedule_history: booking.reschedule_history || [],
        original_booking: booking.original_booking,
        createdAt: booking.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Request reschedule
router.post('/:bookingId/reschedule', requireAuth, async (req, res, next) => {
  try {
    const payload = await rescheduleSchema.validateAsync(req.body);
    const booking = await Booking.findById(req.params.bookingId)
      .populate('master_id', 'user_id display_name working_hours')
      .populate('customer_id', '_id display_name');

    if (!booking) return res.status(404).json({ message: 'Prenotazione non trovata.' });
    
    const isCustomer = booking.customer_id._id.toString() === req.user._id.toString();
    const isMaster = booking.master_id.user_id.toString() === req.user._id.toString();
    
    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Non autorizzato.' });
    }

    if (!['confirmed', 'awaiting_master', 'reschedule_requested'].includes(booking.status)) {
      return res.status(400).json({ message: 'Impossibile riprogrammare questa prenotazione.' });
    }

    // If there's already a pending reschedule request, move it to history
    if (booking.reschedule_request) {
      if (!booking.reschedule_history) booking.reschedule_history = [];
      booking.reschedule_history.push({
        ...booking.reschedule_request,
        response: 'superseded',
        responded_at: new Date()
      });
    }

    // Validate new time slot
    const { blocks, bookings } = await loadDayContext({ 
      masterId: booking.master_id._id, 
      date: payload.newDate 
    });
    
    const slotIsFree = checkAvailability({
      blocks,
      bookings: bookings.filter(b => b._id.toString() !== booking._id.toString()),
      start: payload.newStart,
      end: payload.newEnd,
      date: payload.newDate,
      workingHours: booking.master_id.working_hours
    });

    if (!slotIsFree) {
      return res.status(409).json({ message: 'La nuova fascia oraria non è disponibile.' });
    }

    // Store original booking details if not already stored
    if (!booking.original_booking) booking.original_booking = {};

    if (!booking.original_booking.date) {
      booking.original_booking = {
        date: booking.date,
        start_time: booking.start_time,
        end_time: booking.end_time
      };
    }

    booking.reschedule_request = {
      requested_by: isCustomer ? 'customer' : 'master',
      new_date: payload.newDate,
      new_start_time: payload.newStart,
      new_end_time: payload.newEnd,
      reason: payload.reason || '',
      requested_at: new Date()
    };
    booking.status = 'reschedule_requested';
    await booking.save();

    const targetUserId = isCustomer ? booking.master_id.user_id : booking.customer_id._id;
    const requesterName = isCustomer ? 
      (booking.customer_id.display_name || 'Cliente') : 
      (booking.master_id.display_name || 'Master');

    await createNotification({
      userId: targetUserId,
      type: 'booking:reschedule_requested',
      title: 'Richiesta di riprogrammazione',
      body: `${requesterName} ha richiesto di riprogrammare la sessione del ${booking.date} per il ${payload.newDate}.`,
      meta: { bookingId: booking._id }
    });

    res.json({ message: 'Richiesta di riprogrammazione inviata.' });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Dati non validi.' });
    }
    next(error);
  }
});

// Respond to reschedule request
router.post('/:bookingId/reschedule/respond', requireAuth, async (req, res, next) => {
  try {
    const { action } = await rescheduleResponseSchema.validateAsync(req.body);
    const booking = await Booking.findById(req.params.bookingId)
      .populate('master_id', 'user_id display_name working_hours')
      .populate('customer_id', '_id display_name');

    if (!booking) return res.status(404).json({ message: 'Prenotazione non trovata.' });
    if (booking.status !== 'reschedule_requested') {
      return res.status(400).json({ message: 'Nessuna richiesta di riprogrammazione pendente.' });
    }

    const isCustomer = booking.customer_id._id.toString() === req.user._id.toString();
    const isMaster = booking.master_id.user_id.toString() === req.user._id.toString();
    
    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Non autorizzato.' });
    }

    // Check if user is the one who should respond (opposite of who requested)
    const shouldRespond = (booking.reschedule_request.requested_by === 'customer' && isMaster) ||
                         (booking.reschedule_request.requested_by === 'master' && isCustomer);
    
    if (!shouldRespond) {
      return res.status(403).json({ message: 'Non puoi rispondere alla tua stessa richiesta.' });
    }

    // Store current reschedule request for history
    const currentRequest = { ...booking.reschedule_request };
    
    if (action === 'accept') {
      // Double-check availability
      const { blocks, bookings } = await loadDayContext({ 
        masterId: booking.master_id._id, 
        date: booking.reschedule_request.new_date 
      });
      
      const slotIsFree = checkAvailability({
        blocks,
        bookings: bookings.filter(b => b._id.toString() !== booking._id.toString()),
        start: booking.reschedule_request.new_start_time,
        end: booking.reschedule_request.new_end_time,
        date: booking.reschedule_request.new_date,
        workingHours: booking.master_id.working_hours
      });

      if (!slotIsFree) {
        return res.status(409).json({ message: 'La fascia oraria non è più disponibile.' });
      }

      // Update booking with new schedule
      booking.date = booking.reschedule_request.new_date;
      booking.start_time = booking.reschedule_request.new_start_time;
      booking.end_time = booking.reschedule_request.new_end_time;
      booking.status = 'ready_to_start';
      booking.can_start = true;
      
      // Add to history
      if (!booking.reschedule_history) booking.reschedule_history = [];
      booking.reschedule_history.push({
        ...currentRequest,
        response: 'accepted',
        responded_at: new Date()
      });
      
      booking.reschedule_request = undefined;
      await booking.save();

      const targetUserId = currentRequest.requested_by === 'customer' ? 
        booking.customer_id._id : booking.master_id.user_id;
      
      await createNotification({
        userId: targetUserId,
        type: 'booking:reschedule_accepted',
        title: 'Riprogrammazione accettata',
        body: `La tua richiesta di riprogrammazione è stata accettata. Nuovo orario: ${booking.date} dalle ${booking.start_time} alle ${booking.end_time}.`,
        meta: { bookingId: booking._id }
      });

      res.json({ message: 'Riprogrammazione accettata.' });
    } else {
      booking.status = 'ready_to_start';
      booking.can_start = true;
      
      // Add to history
      if (!booking.reschedule_history) booking.reschedule_history = [];
      booking.reschedule_history.push({
        ...currentRequest,
        response: 'rejected',
        responded_at: new Date()
      });
      
      booking.reschedule_request = undefined;
      await booking.save();

      const targetUserId = currentRequest.requested_by === 'customer' ? 
        booking.customer_id._id : booking.master_id.user_id;
      
      await createNotification({
        userId: targetUserId,
        type: 'booking:reschedule_rejected',
        title: 'Riprogrammazione rifiutata',
        body: 'La tua richiesta di riprogrammazione è stata rifiutata. La prenotazione originale rimane confermata.',
        meta: { bookingId: booking._id }
      });

      res.json({ message: 'Riprogrammazione rifiutata.' });
    }
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Richiesta non valida.' });
    }
    next(error);
  }
});

// Request immediate session start
router.post('/:bookingId/start-now/request', requireAuth, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate('master_id', 'user_id display_name')
      .populate('customer_id', '_id display_name');

    if (!booking) return res.status(404).json({ message: 'Prenotazione non trovata.' });

    const isCustomer = booking.customer_id._id.toString() === req.user._id.toString();
    const isMaster = booking.master_id.user_id.toString() === req.user._id.toString();

    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Non autorizzato.' });
    }

    if (!booking.can_start || booking.status !== 'ready_to_start') {
      return res.status(400).json({ message: 'La prenotazione non è pronta per iniziare.' });
    }

    if (booking.start_now_request?.status === 'pending') {
      return res.status(409).json({ message: 'C\'è già una richiesta di avvio immediato in attesa.' });
    }

    booking.start_now_request = {
      requested_by: isCustomer ? 'customer' : 'master',
      requested_at: new Date(),
      status: 'pending'
    };

    await booking.save();

    const targetUserId = isCustomer ? booking.master_id.user_id : booking.customer_id._id;
    const requesterName = isCustomer ?
      (booking.customer_id.display_name || 'Cliente') :
      (booking.master_id.display_name || 'Master');

    await createNotification({
      userId: targetUserId,
      type: 'booking:start_now_requested',
      title: 'Richiesta di avvio immediato',
      body: `${requesterName} vuole avviare subito la sessione ${booking.reservation_id}.`,
      meta: { bookingId: booking._id, reservationId: booking.reservation_id }
    });

    emitStartNowEvent(booking, {
      action: 'request',
      status: 'pending',
      requestedBy: booking.start_now_request.requested_by,
      requestedAt: booking.start_now_request.requested_at
    });

    res.json({ message: 'Richiesta di avvio immediato inviata.' });
  } catch (error) {
    next(error);
  }
});

// Respond to start now request
router.post('/:bookingId/start-now/respond', requireAuth, async (req, res, next) => {
  try {
    const { action } = await startNowResponseSchema.validateAsync(req.body);
    const booking = await Booking.findById(req.params.bookingId)
      .populate('master_id', 'user_id display_name')
      .populate('customer_id', '_id display_name');

    if (!booking) return res.status(404).json({ message: 'Prenotazione non trovata.' });
    if (!booking.start_now_request || booking.start_now_request.status !== 'pending') {
      return res.status(400).json({ message: 'Nessuna richiesta di avvio immediato pendente.' });
    }

    const isCustomer = booking.customer_id._id.toString() === req.user._id.toString();
    const isMaster = booking.master_id.user_id.toString() === req.user._id.toString();

    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Non autorizzato.' });
    }

    const requesterRole = booking.start_now_request.requested_by;
    const responderRole = isCustomer ? 'customer' : 'master';

    if (requesterRole === responderRole) {
      return res.status(403).json({ message: 'Non puoi rispondere alla tua richiesta.' });
    }

    if (action === 'reject') {
      booking.start_now_request.status = 'rejected';
      booking.start_now_request.responded_at = new Date();
      await booking.save();

      const requesterId = requesterRole === 'customer' ? booking.customer_id._id : booking.master_id.user_id;

      await createNotification({
        userId: requesterId,
        type: 'booking:start_now_rejected',
        title: 'Avvio immediato rifiutato',
        body: 'La tua richiesta di avviare subito la sessione è stata rifiutata.',
        meta: { bookingId: booking._id, reservationId: booking.reservation_id }
      });

      emitStartNowEvent(booking, {
        action: 'response',
        status: 'rejected',
        requestedBy: requesterRole,
        respondedAt: booking.start_now_request.responded_at
      });

      return res.json({ message: 'Richiesta di avvio immediato rifiutata.' });
    }

    booking.start_now_request.status = 'accepted';
    booking.start_now_request.responded_at = new Date();
    const respondedAt = booking.start_now_request.responded_at;

    const starterName = requesterRole === 'customer'
      ? (booking.customer_id.display_name || 'Cliente')
      : (booking.master_id.display_name || 'Master');

    const targetUserId = requesterRole === 'customer' ? booking.master_id.user_id : booking.customer_id._id;
    const requesterId = requesterRole === 'customer' ? booking.customer_id._id : booking.master_id.user_id;

    await startBookingSession({
      booking,
      starterRole: requesterRole,
      starterName,
      targetUserId
    });

    const sessionUrl = booking.channel === 'voice' ? `/voice/${booking._id}` : `/chat/${booking._id}`;

    emitStartNowEvent(booking, {
      action: 'response',
      status: 'accepted',
      requestedBy: requesterRole,
      respondedAt,
      sessionUrl
    });

    await createNotification({
      userId: requesterId,
      type: 'booking:start_now_accepted',
      title: 'Avvio immediato accettato',
      body: 'L\'altra persona ha accettato di iniziare subito la sessione. Unisciti ora!',
      meta: { bookingId: booking._id, reservationId: booking.reservation_id }
    });

    res.json({
      message: 'Sessione avviata con successo.',
      session_url: sessionUrl,
      reservation_id: booking.reservation_id
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Richiesta non valida.' });
    }
    next(error);
  }
});

// Get reservations for both customer and master
router.get('/reservations', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const userId = req.user._id;
    
    // Check if user is a master
    const master = await Master.findOne({ user_id: userId });
    
    let filter = {};
    if (master) {
      // Master can see bookings where they are the master OR the customer
      filter = {
        $or: [
          { master_id: master._id },
          { customer_id: userId }
        ]
      };
    } else {
      // Regular user sees only their customer bookings
      filter = { customer_id: userId };
    }
    
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('master_id', 'display_name avatar_url user_id')
      .populate('customer_id', 'display_name avatar_url')
      .populate('wallet_txn_id', 'amount type createdAt');

    const total = await Booking.countDocuments(filter);

    res.json({
      reservations: bookings.map(booking => ({
        id: booking._id,
        reservation_id: booking.reservation_id,
        master: {
          id: booking.master_id._id,
          name: booking.master_id.display_name,
          avatar: booking.master_id.avatar_url,
          user_id: booking.master_id.user_id
        },
        customer: {
          id: booking.customer_id._id,
          name: booking.customer_id.display_name,
          avatar: booking.customer_id.avatar_url
        },
        date: booking.date,
        start: booking.start_time,
        end: booking.end_time,
        channel: booking.channel,
        status: booking.status,
        can_start: booking.can_start,
        started_by: booking.started_by,
        start_now_request: booking.start_now_request,
        amount_cents: booking.amount_cents,
        duration_minutes: booking.duration_minutes,
        notes: booking.notes,
        reschedule_request: booking.reschedule_request,
        reschedule_history: booking.reschedule_history || [],
        original_booking: booking.original_booking,
        user_role: master && booking.master_id._id.toString() === master._id.toString() ? 'master' : 'customer',
        createdAt: booking.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Start session (mutual confirmation required)
router.post('/:bookingId/start', requireAuth, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate('master_id', 'user_id display_name')
      .populate('customer_id', '_id display_name');

    if (!booking) return res.status(404).json({ message: 'Prenotazione non trovata.' });
    
    const isCustomer = booking.customer_id._id.toString() === req.user._id.toString();
    const isMaster = booking.master_id.user_id.toString() === req.user._id.toString();
    
    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Non autorizzato.' });
    }

    if (!booking.can_start || booking.status !== 'ready_to_start') {
      return res.status(400).json({ message: 'La sessione non può essere avviata ora.' });
    }

    // Check if session is scheduled for now (within 15 minutes)
    const now = new Date();
    const sessionDateTime = new Date(`${booking.date}T${booking.start_time}:00`);
    const timeDiff = Math.abs(now - sessionDateTime) / (1000 * 60); // minutes
    
    if (timeDiff > 15) {
      return res.status(400).json({ message: 'Puoi avviare la sessione solo 15 minuti prima dell\'orario previsto.' });
    }

    const targetUserId = isCustomer ? booking.master_id.user_id : booking.customer_id._id;
    const starterName = isCustomer ?
      (booking.customer_id.display_name || 'Cliente') :
      (booking.master_id.display_name || 'Master');

    await startBookingSession({
      booking,
      starterRole: isCustomer ? 'customer' : 'master',
      starterName,
      targetUserId
    });

    res.json({ 
      message: 'Sessione avviata con successo.',
      session_url: booking.channel === 'voice' ? `/voice/${booking._id}` : `/chat/${booking._id}`,
      reservation_id: booking.reservation_id
    });
  } catch (error) {
    next(error);
  }
});

export default router;