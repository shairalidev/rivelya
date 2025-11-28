import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Session } from '../models/session.model.js';
import { Master } from '../models/master.model.js';
import { notifyVoiceSessionEnded, notifyVoiceSessionStarted } from '../utils/voice-events.js';
import { emitSessionStatus } from '../utils/session-events.js';
import { completeBookingAndPromptReview } from '../utils/booking-events.js';

const resolveUserReference = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) {
    return value._id.toString();
  }
  if (typeof value.toString === 'function') {
    return value.toString();
  }
  return null;
};

const router = Router();

// GET /voice/sessions - Get user's voice sessions
router.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    console.info('[voice] GET /voice/sessions', { userId: req.user._id.toString() });
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

    console.info('[voice] Returning voice sessions', { userId: req.user._id.toString(), count: serialized.length });
    res.json(serialized);
  } catch (error) {
    console.error('[voice] Failed to list voice sessions', { userId: req.user._id.toString(), message: error.message });
    next(error);
  }
});

// GET /voice/session/:id - Get specific voice session
router.get('/session/:id', requireAuth, async (req, res, next) => {
  try {
    console.info('[voice] GET /voice/session/:id', { sessionId: req.params.id, userId: req.user._id.toString() });
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
      console.warn('[voice] Voice session access denied', { sessionId: req.params.id, userId: req.user._id.toString() });
      return res.status(403).json({ message: 'Accesso negato' });
    }

    const viewerRole = isCustomer ? 'client' : isMaster ? 'master' : null;
    const canCall = session.status === 'created' || session.status === 'active';
    const masterUserId = resolveUserReference(session.master_id?.user_id);
    const customerUserId = resolveUserReference(session.user_id);

    const userId = req.user._id.toString();
    const userNote = session.notes?.get(userId);
    
    console.info('[voice] Returning voice session detail', { sessionId: req.params.id, viewerRole });
    res.json({
      session: {
        id: session._id,
        channel: session.channel,
        status: session.status,
        rate: session.price_cpm,
        startTime: session.start_ts,
        endTime: session.end_ts,
        master: session.master_id ? {
          id: masterUserId,
          name: session.master_id.display_name || 'Master Rivelya',
          avatarUrl: session.master_id.media?.avatar_url
        } : null,
        customer: session.user_id ? {
          id: customerUserId,
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
    console.error('[voice] Failed to fetch voice session', { sessionId: req.params.id, message: error.message });
    next(error);
  }
});

// PUT /voice/session/:id/note - Update session note
router.put('/session/:id/note', requireAuth, async (req, res, next) => {
  try {
    const { note } = req.body;
    console.info('[voice] PUT /voice/session/:id/note', { sessionId: req.params.id, userId: req.user._id.toString() });
    const session = await Session.findById(req.params.id)
      .populate('master_id', 'user_id');

    if (!session) {
      return res.status(404).json({ message: 'Sessione non trovata' });
    }

    // Check access
    const isCustomer = session.user_id.toString() === req.user._id.toString();
    const isMaster = session.master_id?.user_id?.toString() === req.user._id.toString();
    
    if (!isCustomer && !isMaster) {
      console.warn('[voice] Voice session note update denied', { sessionId: req.params.id, userId: req.user._id.toString() });
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
    console.info('[voice] Updated voice session note', { sessionId: req.params.id, userId: req.user._id.toString() });
    res.json({
      note: userNote?.content || '',
      noteUpdatedAt: userNote?.updatedAt || now
    });
  } catch (error) {
    console.error('[voice] Failed to update voice session note', { sessionId: req.params.id, message: error.message });
    next(error);
  }
});

// POST /voice/session/:id/start - Start voice call
router.post('/session/:id/start', requireAuth, async (req, res, next) => {
  try {
    console.info('[voice] POST /voice/session/:id/start', { sessionId: req.params.id, userId: req.user._id.toString() });
    const session = await Session.findById(req.params.id)
      .populate({
        path: 'master_id',
        select: 'display_name user_id',
        populate: { path: 'user_id', select: 'display_name phone' }
      })
      .populate('user_id', 'display_name phone');

    if (!session) {
      return res.status(404).json({ message: 'Sessione non trovata' });
    }

    // Check access
    const isCustomer = session.user_id._id.toString() === req.user._id.toString();
    const isMaster = session.master_id?.user_id?.toString() === req.user._id.toString();
    
    if (!isCustomer && !isMaster) {
      console.warn('[voice] Voice session start denied', { sessionId: req.params.id, userId: req.user._id.toString() });
      return res.status(403).json({ message: 'Accesso negato' });
    }

    if (session.status !== 'created') {
      console.warn('[voice] Voice session already active/ended', { sessionId: req.params.id, status: session.status });
      return res.status(400).json({ message: 'Sessione già avviata o terminata' });
    }

    // Initialize WebRTC call instead of Twilio
    const callResult = { status: 'webrtc_initiated', type: 'webrtc' };

    const now = new Date();
    if (!session.start_ts) {
      session.start_ts = now;
    }
    if (!session.end_ts) {
      session.end_ts = new Date(session.start_ts.getTime() + 60 * 60 * 1000);
    }
    session.status = 'active';
    await session.save();

    // Emit session started event to both participants for WebRTC initialization
    const { emitToUser } = await import('../lib/socket.js');
    const sessionData = {
      sessionId: session._id,
      startedBy: req.user._id,
      status: 'active'
    };
    
    emitToUser(session.user_id._id, 'voice:session:started', sessionData);
    emitToUser(session.master_id.user_id, 'voice:session:started', sessionData);

    emitSessionStatus({
      sessionId: session._id,
      channel: session.channel,
      status: 'started',
      userId: session.user_id._id,
      masterUserId: session.master_id.user_id
    });

    await notifyVoiceSessionStarted({ session, startedBy: req.user._id });

    console.info('[voice] Voice session started successfully', {
      sessionId: session._id.toString(),
      startedBy: req.user._id.toString(),
      callStatus: callResult?.status
    });
    res.json({
      message: 'Chiamata avviata',
      status: 'active',
      startTime: now,
      expiresAt: session.end_ts,
      callResult
    });
  } catch (error) {
    console.error('[voice] Failed to start voice session', { sessionId: req.params.id, message: error.message });
    next(error);
  }
});

// POST /voice/session/:id/signal - WebRTC signaling
router.post('/session/:id/signal', requireAuth, async (req, res, next) => {
  try {
    const { type, data } = req.body;
    
    if (!['offer', 'answer', 'ice-candidate'].includes(type)) {
      return res.status(400).json({ message: 'Tipo di segnale non valido.' });
    }

    const session = await Session.findById(req.params.id)
      .populate('master_id', 'user_id')
      .populate('user_id', '_id');

    if (!session) {
      return res.status(404).json({ message: 'Sessione non trovata.' });
    }

    const isCustomer = session.user_id._id.toString() === req.user._id.toString();
    const isMaster = session.master_id?.user_id?.toString() === req.user._id.toString();
    
    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Non autorizzato per questa sessione.' });
    }

    if (session.status !== 'active') {
      return res.status(409).json({ message: 'La sessione non è attiva.' });
    }

    // Send signal to the other participant
    const targetUserId = isCustomer ? session.master_id.user_id : session.user_id._id;
    const { emitToUser } = await import('../lib/socket.js');
    
    emitToUser(targetUserId, 'voice:webrtc:signal', {
      sessionId: session._id,
      type,
      data,
      from: req.user._id
    });

    console.info('[voice] WebRTC signal relayed', { sessionId: req.params.id, type, from: req.user._id.toString(), to: targetUserId.toString() });
    res.json({ success: true });
  } catch (error) {
    console.error('[voice] Failed to relay WebRTC signal', { sessionId: req.params.id, message: error.message });
    next(error);
  }
});

// POST /voice/session/:id/end - End voice call
router.post('/session/:id/end', requireAuth, async (req, res, next) => {
  try {
    console.info('[voice] POST /voice/session/:id/end', { sessionId: req.params.id, userId: req.user._id.toString() });
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
      console.warn('[voice] Voice session end denied', { sessionId: req.params.id, userId: req.user._id.toString() });
      return res.status(403).json({ message: 'Accesso negato' });
    }

    if (session.status === 'ended') {
      console.warn('[voice] Voice session already ended', { sessionId: req.params.id });
      return res.status(400).json({ message: 'Sessione già terminata' });
    }

    // End WebRTC call
    const endResult = { status: 'webrtc_ended', type: 'webrtc' };

    const now = new Date();
    session.status = 'ended';
    session.end_ts = now;
    if (session.start_ts) {
      session.duration_s = Math.floor((now - session.start_ts) / 1000);
      const durationMinutes = Math.ceil(session.duration_s / 60);
      session.cost_cents = durationMinutes * session.price_cpm;
    }
    await session.save();

    // Update booking status and notify participants if this session is linked to a booking
    if (session.booking_id) {
      await completeBookingAndPromptReview(session.booking_id);
    }

    // Emit WebRTC call end events
    const { emitToUser } = await import('../lib/socket.js');
    const endData = {
      sessionId: session._id,
      status: 'ended',
      duration: session.duration_s
    };
    
    emitToUser(session.user_id._id, 'voice:call:ended', endData);
    emitToUser(session.master_id.user_id, 'voice:call:ended', endData);

    await notifyVoiceSessionEnded({ session, endedBy: req.user._id });

    console.info('[voice] Voice session ended successfully', {
      sessionId: session._id.toString(),
      endedBy: req.user._id.toString(),
      endStatus: endResult?.status,
      duration: session.duration_s,
      cost: session.cost_cents
    });
    res.json({
      message: 'Chiamata terminata',
      status: session.status,
      duration: session.duration_s,
      cost: session.cost_cents,
      endResult
    });
  } catch (error) {
    console.error('[voice] Failed to end voice session', { sessionId: req.params.id, message: error.message });
    next(error);
  }
});

export default router;
