import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Session } from '../models/session.model.js';
import { Master } from '../models/master.model.js';
import { billing } from '../services/billing.service.js';
import { telephony } from '../services/telephony.service.js';

const router = Router();

// POST /session/voice { master_id }
router.post('/voice', requireAuth, async (req, res, next) => {
  try {
    const { master_id } = req.body;
    const master = await Master.findById(master_id);
    if (!master || master.status !== 'active') return res.status(400).json({ message: 'Master unavailable' });
    if (!master.services?.voice) return res.status(400).json({ message: 'Voice service not available' });

    // Check if user already has an active voice session
    const existingUserSession = await Session.findOne({
      user_id: req.user._id,
      channel: { $in: ['voice', 'chat_voice'] },
      status: { $in: ['created', 'active'] }
    });
    if (existingUserSession) {
      return res.status(400).json({ message: 'Hai già una sessione vocale attiva. Completa quella prima di iniziarne una nuova.' });
    }

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

    const bridge = await telephony.initiateCallback({ session: sess, master, user: req.user });

    res.json({ session_id: sess._id, call: bridge, redirect_url: `/voice/${sess._id}` });
  } catch (e) { next(e); }
});

// POST /session/chat-voice { master_id }
router.post('/chat-voice', requireAuth, async (req, res, next) => {
  try {
    const { master_id } = req.body;
    const master = await Master.findById(master_id);
    if (!master || master.status !== 'active') return res.status(400).json({ message: 'Master unavailable' });
    if (!master.services?.chat_voice) return res.status(400).json({ message: 'Chat+Voice service not available' });

    // Check if user already has an active voice session
    const existingUserSession = await Session.findOne({
      user_id: req.user._id,
      channel: { $in: ['voice', 'chat_voice'] },
      status: { $in: ['created', 'active'] }
    });
    if (existingUserSession) {
      return res.status(400).json({ message: 'Hai già una sessione vocale attiva. Completa quella prima di iniziarne una nuova.' });
    }

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

    const bridge = await telephony.initiateCallback({ session: sess, master, user: req.user });

    res.json({ session_id: sess._id, call: bridge, redirect_url: `/chat` });
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

    res.json({ session_id: sess._id, ws_url: '/ws/chat', price_cpm: priceCpm });
  } catch (e) { next(e); }
});

export default router;
