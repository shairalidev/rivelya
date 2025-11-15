import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Session } from '../models/session.model.js';
import { Master } from '../models/master.model.js';
import { billing } from '../services/billing.service.js';
import { telephony } from '../services/telephony.service.js';

const router = Router();

// POST /session/chat-voice { master_id }
router.post('/chat-voice', requireAuth, async (req, res, next) => {
  try {
    const { master_id } = req.body;
    const master = await Master.findById(master_id);
    if (!master || master.status !== 'active') return res.status(400).json({ message: 'Master unavailable' });

    const priceCpm = await billing.resolvePriceCpm({ user: req.user, master, channel: 'chat_voice' });

    const sess = await Session.create({
      user_id: req.user._id,
      master_id: master._id,
      channel: 'chat_voice',
      price_cpm: priceCpm,
      status: 'created'
    });

    const bridge = await telephony.initiateCallback({ session: sess, master, user: req.user });

    res.json({ session_id: sess._id, call: bridge });
  } catch (e) { next(e); }
});

// POST /session/chat { master_id }  (stub for WebSocket initiation)
router.post('/chat', requireAuth, async (req, res, next) => {
  try {
    const { master_id } = req.body;
    const master = await Master.findById(master_id);
    if (!master || master.status !== 'active') return res.status(400).json({ message: 'Master unavailable' });

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
