import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Session } from '../models/session.model.js';
import { Master } from '../models/master.model.js';
import { billing } from '../services/billing.service.js';
import { notifyVoiceSessionCreated } from '../utils/voice-events.js';
import { emitSessionStatus } from '../utils/session-events.js';

const router = Router();

// POST /session/voice { master_id }
router.post('/voice', requireAuth, async (req, res, next) => {
  try {
    const { master_id } = req.body;
    const master = await Master.findById(master_id);
    if (!master || master.status !== 'active') return res.status(400).json({ message: 'Master unavailable' });
    if (!master.services?.voice) return res.status(400).json({ message: 'Voice service not available' });

    // Check if master already has an active voice session
    const existingMasterSession = await Session.findOne({
      master_id: master._id,
      channel: { $in: ['voice', 'chat_voice'] },
      status: { $in: ['created', 'active'] }
    });
    if (existingMasterSession) {
      return res.status(400).json({ message: 'Il master ha già una sessione vocale attiva. Riprova più tardi.' });
    }

    const priceCpm = await billing.resolvePriceCpm({ user: req.user, master, channel: 'voice' });

    const sess = await Session.create({
      user_id: req.user._id,
      master_id: master._id,
      channel: 'voice',
      price_cpm: priceCpm,
      status: 'created'
    });

    await notifyVoiceSessionCreated({
      session: sess,
      customerUser: req.user,
      masterUserId: master.user_id
    });

    res.json({ session_id: sess._id, redirect_url: `/voice/${sess._id}` });
  } catch (e) { next(e); }
});

// POST /session/chat-voice { master_id }
router.post('/chat-voice', requireAuth, async (req, res, next) => {
  try {
    const { master_id } = req.body;
    const master = await Master.findById(master_id);
    if (!master || master.status !== 'active') return res.status(400).json({ message: 'Master unavailable' });
    if (!master.services?.chat_voice) return res.status(400).json({ message: 'Chat+Voice service not available' });

    // Check if master already has an active voice session
    const existingMasterSession = await Session.findOne({
      master_id: master._id,
      channel: { $in: ['voice', 'chat_voice'] },
      status: { $in: ['created', 'active'] }
    });
    if (existingMasterSession) {
      return res.status(400).json({ message: 'Il master ha già una sessione vocale attiva. Riprova più tardi.' });
    }

    const priceCpm = await billing.resolvePriceCpm({ user: req.user, master, channel: 'chat_voice' });

    const sess = await Session.create({
      user_id: req.user._id,
      master_id: master._id,
      channel: 'chat_voice',
      price_cpm: priceCpm,
      status: 'created'
    });

    await notifyVoiceSessionCreated({
      session: sess,
      customerUser: req.user,
      masterUserId: master.user_id
    });

    res.json({ session_id: sess._id, redirect_url: `/chat` });
  } catch (e) { next(e); }
});

// GET /session/:id - Get session details
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('master_id', 'display_name media')
      .populate('user_id', 'display_name');
    
    if (!session) return res.status(404).json({ message: 'Session not found' });
    
    // Check if user has access to this session
    const isOwner = session.user_id._id.toString() === req.user._id.toString();
    const isMaster = session.master_id && req.user.masterId && session.master_id._id.toString() === req.user.masterId.toString();
    
    if (!isOwner && !isMaster) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      id: session._id,
      channel: session.channel,
      status: session.status,
      rate: session.price_cpm,
      startTime: session.start_ts,
      endTime: session.end_ts,
      duration: session.duration_s,
      master: {
        name: session.master_id?.display_name || 'Master Rivelya',
        avatarUrl: session.master_id?.media?.avatar_url
      }
    });
  } catch (e) { next(e); }
});

// POST /session/chat { master_id }  (stub for WebSocket initiation)
router.post('/chat', requireAuth, async (req, res, next) => {
  try {
    const { master_id } = req.body;
    const master = await Master.findById(master_id);
    if (!master || master.status !== 'active') return res.status(400).json({ message: 'Master unavailable' });
    if (!master.services?.chat) return res.status(400).json({ message: 'Chat service not available' });

    const priceCpm = await billing.resolvePriceCpm({ user: req.user, master, channel: 'chat' });

    const sess = await Session.create({
      user_id: req.user._id,
      master_id: master._id,
      channel: 'chat',
      price_cpm: priceCpm,
      status: 'active',
      start_ts: new Date()
    });

    emitSessionStatus({
      sessionId: sess._id,
      channel: sess.channel,
      status: 'started',
      userId: req.user._id,
      masterUserId: master.user_id
    });

    res.json({ session_id: sess._id, ws_url: '/ws/chat', price_cpm: priceCpm });
  } catch (e) { next(e); }
});

// GET /session/history - Get user's session history
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { user_id: req.user._id };
    if (status) filter.status = status;

    const sessions = await Session.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('master_id', 'display_name avatar_url services')
      .populate('booking_id', 'date start_time end_time channel');

    const total = await Session.countDocuments(filter);

    res.json({
      sessions: sessions.map(session => ({
        id: session._id,
        master: {
          id: session.master_id._id,
          name: session.master_id.display_name,
          avatar: session.master_id.avatar_url
        },
        channel: session.channel,
        status: session.status,
        startTime: session.start_ts,
        endTime: session.end_ts,
        duration: session.duration_s,
        cost: session.cost_cents,
        rate: session.price_cpm,
        booking: session.booking_id ? {
          date: session.booking_id.date,
          start: session.booking_id.start_time,
          end: session.booking_id.end_time
        } : null,
        createdAt: session.createdAt
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

export default router;
