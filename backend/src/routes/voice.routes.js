import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Session } from '../models/session.model.js';
import { Master } from '../models/master.model.js';
import { notifyVoiceSessionEnded, notifyVoiceSessionStarted } from '../utils/voice-events.js';

const router = Router();

// GET /voice/sessions - Get user's voice sessions
router.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    // Find master if user is a master
    const master = await Master.findOne({ user_id: req.user._id });
    
    const query = {
      $or: [
        { user_id: req.user._id, channel: { $in: ['voice', 'chat_voice'] } }
      ]
    };
    
    // Add master sessions if user is a master
    if (master) {
      query.$or.push({ master_id: master._id, channel: { $in: ['voice', 'chat_voice'] } });
    }
    
    const sessions = await Session.find(query)
    .populate('master_id', 'display_name media')
    .populate('user_id', 'display_name avatar_url')
    .sort({ createdAt: -1 })
    .limit(100);

    const serialized = sessions.map(session => {
      const isUserMaster = master && session.master_id && session.master_id._id.toString() === master._id.toString();
      const isUserCustomer = session.user_id && session.user_id._id.toString() === req.user._id.toString();
      
      return {
        id: session._id,
        channel: session.channel,
        status: session.status,
        startTime: session.start_ts,
        endTime: session.end_ts,
        duration: session.duration_s,
        cost: session.cost_cents,
        rate: session.price_cpm,
        master: session.master_id ? {
          name: session.master_id.display_name || 'Master Rivelya',
          avatarUrl: session.master_id.media?.avatar_url
        } : null,
        customer: session.user_id ? {
          name: session.user_id.display_name || 'Cliente',
          avatarUrl: session.user_id.avatar_url
        } : null,
        createdAt: session.createdAt,
        expiresAt: session.end_ts,
        remainingSeconds: session.end_ts && session.status === 'active' ? 
          Math.max(0, Math.floor((new Date(session.end_ts) - new Date()) / 1000)) : null,
        viewerRole: isUserMaster ? 'master' : isUserCustomer ? 'client' : null
      };
    });

    res.json(serialized);
  } catch (error) {
    next(error);
  }
});

// GET /voice/session/:id - Get specific voice session
router.get('/session/:id', requireAuth, async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('master_id', 'display_name media user_id')
      .populate('user_id', 'display_name avatar_url');

    if (!session) {
      return res.status(404).json({ message: 'Sessione non trovata' });
    }

    // Find master if user is a master
    const master = await Master.findOne({ user_id: req.user._id });
    
    // Check access
    const isCustomer = session.user_id && session.user_id._id.toString() === req.user._id.toString();
    const isMaster = master && session.master_id && session.master_id._id.toString() === master._id.toString();
    
    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Accesso negato' });
    }

    const viewerRole = isCustomer ? 'client' : isMaster ? 'master' : null;
    const canCall = session.status === 'created' || session.status === 'active';

    const userId = req.user._id.toString();
    const userNote = session.notes?.get(userId);
    
    res.json({
      session: {
        id: session._id,
        channel: session.channel,
        status: session.status,
        rate: session.price_cpm,
        startTime: session.start_ts,
        endTime: session.end_ts,
        master: session.master_id ? {
          name: session.master_id.display_name || 'Master Rivelya',
          avatarUrl: session.master_id.media?.avatar_url
        } : null,
        customer: session.user_id ? {
          name: session.user_id.display_name || 'Cliente',
          avatarUrl: session.user_id.avatar_url
        } : null,
        expiresAt: session.end_ts,
        note: userNote?.content || ''
      },
      viewerRole,
      canCall,
      noteUpdatedAt: userNote?.updatedAt
    });
  } catch (error) {
    next(error);
  }
});

// PUT /voice/session/:id/note - Update session note
router.put('/session/:id/note', requireAuth, async (req, res, next) => {
  try {
    const { note } = req.body;
    const session = await Session.findById(req.params.id)
      .populate('master_id', 'user_id');

    if (!session) {
      return res.status(404).json({ message: 'Sessione non trovata' });
    }

    // Check access
    const isCustomer = session.user_id.toString() === req.user._id.toString();
    const isMaster = session.master_id?.user_id?.toString() === req.user._id.toString();
    
    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Accesso negato' });
    }

    const userId = req.user._id.toString();
    const now = new Date();
    
    if (!session.notes) {
      session.notes = new Map();
    }
    
    session.notes.set(userId, {
      content: note || '',
      updatedAt: now
    });
    
    await session.save();

    const userNote = session.notes.get(userId);
    res.json({
      note: userNote?.content || '',
      noteUpdatedAt: userNote?.updatedAt || now
    });
  } catch (error) {
    next(error);
  }
});

// POST /voice/session/:id/start - Start voice call
router.post('/session/:id/start', requireAuth, async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('master_id', 'user_id display_name phone')
      .populate('user_id', 'display_name phone');

    if (!session) {
      return res.status(404).json({ message: 'Sessione non trovata' });
    }

    // Check access
    const isCustomer = session.user_id._id.toString() === req.user._id.toString();
    const isMaster = session.master_id?.user_id?.toString() === req.user._id.toString();
    
    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Accesso negato' });
    }

    if (session.status !== 'created') {
      return res.status(400).json({ message: 'Sessione già avviata o terminata' });
    }

    // Initialize Twilio call
    const { telephony } = await import('../services/telephony.service.js');
    const callResult = await telephony.initiateCallback({
      session,
      master: session.master_id,
      user: session.user_id
    });

    const now = new Date();
    if (!session.start_ts) {
      session.start_ts = now;
    }
    if (!session.end_ts) {
      session.end_ts = new Date(session.start_ts.getTime() + 60 * 60 * 1000);
    }
    session.status = 'active';
    await session.save();

    // Emit to both participants
    const { emitToUser, emitToSession } = await import('../services/socket.service.js');
    emitToSession(session._id, 'voice:session:started', {
      sessionId: session._id,
      startedBy: req.user._id,
      callResult
    });
    emitToUser(session.user_id._id, 'voice:session:started', { sessionId: session._id, startedBy: req.user._id });
    emitToUser(session.master_id.user_id, 'voice:session:started', { sessionId: session._id, startedBy: req.user._id });

    await notifyVoiceSessionStarted({ session, startedBy: req.user._id });

    res.json({
      message: 'Chiamata avviata',
      status: 'active',
      startTime: now,
      expiresAt: session.end_ts,
      callResult
    });
  } catch (error) {
    next(error);
  }
});

// POST /voice/session/:id/end - End voice call
router.post('/session/:id/end', requireAuth, async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('master_id', 'user_id display_name')
      .populate('user_id', 'display_name');

    if (!session) {
      return res.status(404).json({ message: 'Sessione non trovata' });
    }

    // Check access
    const isCustomer = session.user_id._id.toString() === req.user._id.toString();
    const isMaster = session.master_id?.user_id?.toString() === req.user._id.toString();
    
    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Accesso negato' });
    }

    if (session.status === 'ended') {
      return res.status(400).json({ message: 'Sessione già terminata' });
    }

    // End Twilio call
    const { telephony } = await import('../services/telephony.service.js');
    const endResult = await telephony.endCall(session._id);

    const now = new Date();
    session.status = 'ended';
    session.end_ts = now;
    if (session.start_ts) {
      session.duration_s = Math.floor((now - session.start_ts) / 1000);
      const durationMinutes = Math.ceil(session.duration_s / 60);
      session.cost_cents = durationMinutes * session.price_cpm;
    }
    await session.save();

    // Emit to both participants
    const { emitToUser, emitToSession } = await import('../services/socket.service.js');
    emitToSession(session._id, 'voice:session:ended', {
      sessionId: session._id,
      endedBy: req.user._id,
      endResult
    });
    emitToUser(session.user_id._id, 'voice:session:ended', { sessionId: session._id, endedBy: req.user._id });
    emitToUser(session.master_id.user_id, 'voice:session:ended', { sessionId: session._id, endedBy: req.user._id });

    await notifyVoiceSessionEnded({ session, endedBy: req.user._id });

    res.json({
      message: 'Chiamata terminata',
      status: session.status,
      duration: session.duration_s,
      cost: session.cost_cents,
      endResult
    });
  } catch (error) {
    next(error);
  }
});

export default router;