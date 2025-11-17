import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middleware/auth.js';
import { ChatThread } from '../models/chat-thread.model.js';
import { ChatMessage } from '../models/chat-message.model.js';
import { Master } from '../models/master.model.js';
import { emitToUser } from '../lib/socket.js';
import { ChatThreadNote } from '../models/chat-thread-note.model.js';
import { ChatCall } from '../models/chat-call.model.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

const messageSchema = Joi.object({
  body: Joi.string().trim().min(1).max(2000).required()
});

const resolveDisplayName = user =>
  user?.display_name
  || [user?.first_name, user?.last_name].filter(Boolean).join(' ')
  || user?.email
  || 'Utente';

const noteSchema = Joi.object({
  note: Joi.string().allow('', null).max(4000)
});

const buildThreadPayload = (thread, { lastMessage = null, unreadCount = 0 } = {}) => {
  const now = Date.now();
  const expiresAt = thread.expires_at ? thread.expires_at.getTime() : null;
  const remaining = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0;
  const status = remaining === 0 ? 'expired' : thread.status;

  const services = thread.master_id?.services || {};
  const normalizedServices = {
    chat: services.chat !== false,
    chatVoice: services.chat_voice ?? services.phone ?? false
  };

  return {
    id: thread._id,
    booking: thread.booking_id ? {
      id: thread.booking_id._id,
      date: thread.booking_id.date,
      start: thread.booking_id.start_time,
      end: thread.booking_id.end_time,
      channel: thread.booking_id.channel,
      status: thread.booking_id.status
    } : null,
    master: thread.master_id
      ? {
          id: thread.master_id._id,
          name: thread.master_id.display_name,
          userId: thread.master_user_id?._id || thread.master_user_id,
          avatarUrl: thread.master_user_id?.avatar_url || null,
          chatVoiceRateCpm: typeof thread.master_id.rate_chat_voice_cpm === 'number'
            ? thread.master_id.rate_chat_voice_cpm
            : typeof thread.master_id.rate_phone_cpm === 'number'
              ? thread.master_id.rate_phone_cpm
              : null,
          chatRateCpm: typeof thread.master_id.rate_chat_cpm === 'number'
            ? thread.master_id.rate_chat_cpm
            : null,
          services: normalizedServices
        }
      : null,
    customer: thread.customer_id ? {
      id: thread.customer_id._id,
      name: resolveDisplayName(thread.customer_id),
      avatarUrl: thread.customer_id.avatar_url || null
    } : null,
    channel: thread.channel,
    allowedSeconds: thread.allowed_seconds,
    startedAt: thread.started_at,
    expiresAt: thread.expires_at,
    remainingSeconds: remaining,
    status,
    lastMessage: lastMessage
      ? {
          id: lastMessage._id,
          body: lastMessage.body,
          senderId: lastMessage.sender_id,
          senderRole: lastMessage.sender_role,
          createdAt: lastMessage.createdAt
        }
      : null,
    unreadCount
  };
};

const buildActiveCallPayload = (call, thread, viewerId) => {
  if (!call) return null;

  const viewerIdStr = viewerId?.toString();
  const masterUserId = thread.master_user_id?._id || thread.master_user_id;
  const callerName = call.caller_id.toString() === masterUserId?.toString()
    ? thread.master_id?.display_name
    : resolveDisplayName(thread.customer_id);

  return {
    callId: call._id,
    threadId: call.thread_id,
    callerId: call.caller_id,
    calleeId: call.callee_id,
    callerName,
    status: call.status,
    startedAt: call.started_at,
    isIncoming: call.callee_id.toString() === viewerIdStr
  };
};

const ensureThreadForUser = async (threadId, user) => {
  const thread = await ChatThread.findById(threadId)
    .populate('booking_id', 'date start_time end_time channel status')
    .populate('master_id', 'display_name rate_chat_cpm rate_chat_voice_cpm services')
    .populate('master_user_id', 'display_name first_name last_name email avatar_url')
    .populate('customer_id', 'display_name first_name last_name email avatar_url');
  if (!thread) return null;
  const userId = user._id.toString();
  const isCustomer = thread.customer_id?._id?.toString() === userId;
  const isMaster = thread.master_user_id?._id?.toString() === userId;
  if (!isCustomer && !isMaster) return null;
  return { thread, isCustomer, isMaster };
};

router.get('/threads', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const master = await Master.findOne({ user_id: userId }).select('_id');

    const match = [{ customer_id: userId }];
    if (master) {
      match.push({ master_user_id: userId });
    }

    const threads = await ChatThread.find({ $or: match })
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('booking_id', 'date start_time end_time channel status')
      .populate('master_id', 'display_name rate_chat_cpm rate_chat_voice_cpm services')
      .populate('master_user_id', 'display_name first_name last_name email avatar_url')
      .populate('customer_id', 'display_name first_name last_name email avatar_url');

    const threadIds = threads.map(thread => thread._id);
    if (threadIds.length === 0) {
      return res.json({ threads: [] });
    }

    const unreadAgg = await ChatMessage.aggregate([
      { $match: { thread_id: { $in: threadIds }, read_by: { $ne: userId } } },
      { $group: { _id: '$thread_id', count: { $sum: 1 } } }
    ]);
    const unreadMap = new Map(unreadAgg.map(item => [item._id.toString(), item.count]));

    const lastMessageAgg = await ChatMessage.aggregate([
      { $match: { thread_id: { $in: threadIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$thread_id',
          message: { $first: '$$ROOT' }
        }
      }
    ]);
    const lastMap = new Map(lastMessageAgg.map(item => [item._id.toString(), item.message]));

    const payload = threads.map(thread =>
      buildThreadPayload(thread, {
        lastMessage: lastMap.get(thread._id.toString()) || null,
        unreadCount: unreadMap.get(thread._id.toString()) || 0
      })
    );

    res.json({ threads: payload });
  } catch (error) {
    next(error);
  }
});

router.get('/threads/:threadId', requireAuth, async (req, res, next) => {
  try {
    const { thread, isCustomer, isMaster } = (await ensureThreadForUser(req.params.threadId, req.user)) || {};
    if (!thread) return res.status(404).json({ message: 'Conversazione non trovata.' });

    const now = new Date();
    if (thread.expires_at && thread.expires_at <= now && thread.status !== 'expired') {
      thread.status = 'expired';
      await thread.save();
    }

    const messages = await ChatMessage.find({ thread_id: thread._id })
      .sort({ createdAt: 1 })
      .limit(500);

    await ChatMessage.updateMany(
      { thread_id: thread._id, read_by: { $ne: req.user._id } },
      { $addToSet: { read_by: req.user._id } }
    );

    const remaining = thread.expires_at ? Math.max(0, Math.floor((thread.expires_at.getTime() - Date.now()) / 1000)) : 0;

    const note = await ChatThreadNote.findOne({ thread_id: thread._id, user_id: req.user._id }).select('note updatedAt');
    const activeCall = await ChatCall.findOne({
      thread_id: thread._id,
      status: { $in: ['calling', 'accepted'] }
    }).sort({ createdAt: -1 });

    res.json({
      thread: buildThreadPayload(thread),
      viewerRole: isMaster ? 'master' : isCustomer ? 'client' : 'guest',
      messages: messages.map(message => ({
        id: message._id,
        body: message.body,
        senderId: message.sender_id,
        senderRole: message.sender_role,
        createdAt: message.createdAt
      })),
      remainingSeconds: remaining,
      canPost: remaining > 0 && thread.status === 'open',
      note: note?.note || '',
      noteUpdatedAt: note?.updatedAt || null,
      activeCall: buildActiveCallPayload(activeCall, thread, req.user._id)
    });
  } catch (error) {
    next(error);
  }
});

router.put('/threads/:threadId/note', requireAuth, async (req, res, next) => {
  try {
    const payload = await noteSchema.validateAsync(req.body);
    const ensured = await ensureThreadForUser(req.params.threadId, req.user);
    if (!ensured) return res.status(404).json({ message: 'Conversazione non trovata.' });

    const noteContent = typeof payload.note === 'string' ? payload.note : '';

    const note = await ChatThreadNote.findOneAndUpdate(
      { thread_id: ensured.thread._id, user_id: req.user._id },
      { $set: { note: noteContent } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ note: note.note || '', noteUpdatedAt: note.updatedAt });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Nota non valida.' });
    }
    next(error);
  }
});

router.post('/threads/:threadId/messages', requireAuth, async (req, res, next) => {
  try {
    const payload = await messageSchema.validateAsync(req.body);
    const ensured = await ensureThreadForUser(req.params.threadId, req.user);
    if (!ensured) return res.status(404).json({ message: 'Conversazione non trovata.' });
    const { thread, isMaster, isCustomer } = ensured;

    if (!isMaster && !isCustomer) {
      return res.status(403).json({ message: 'Accesso non consentito.' });
    }

    const now = new Date();
    if (thread.expires_at && thread.expires_at <= now) {
      if (thread.status !== 'expired') {
        thread.status = 'expired';
        await thread.save();
      }
      return res.status(403).json({ message: 'Il tempo a disposizione per la chat è terminato.' });
    }

    const senderRole = isMaster ? 'master' : 'client';

    const message = await ChatMessage.create({
      thread_id: thread._id,
      sender_id: req.user._id,
      sender_role: senderRole,
      body: payload.body,
      read_by: [req.user._id]
    });

    thread.last_message_at = message.createdAt;
    await thread.save();

    const response = {
      id: message._id,
      body: message.body,
      senderId: message.sender_id,
      senderRole: message.sender_role,
      createdAt: message.createdAt,
      threadId: thread._id
    };

    emitToUser(thread.customer_id, 'chat:message', response);
    emitToUser(thread.master_user_id, 'chat:message', response);

    const recipient = isMaster ? thread.customer_id : thread.master_user_id;
    const recipientId = recipient?._id || recipient;
    if (recipientId) {
      const senderName = resolveDisplayName(req.user);
      const snippet = typeof message.body === 'string'
        ? (message.body.length > 140 ? `${message.body.slice(0, 137)}…` : message.body)
        : 'Hai un nuovo messaggio in chat.';
      try {
        await createNotification({
          userId: recipientId,
          type: 'chat:message',
          title: 'Nuovo messaggio in chat',
          body: `${senderName}: ${snippet}`,
          meta: { threadId: thread._id, messageId: message._id }
        });
      } catch (notifyError) {
        console.warn('Failed to create chat notification', notifyError);
      }
    }

    res.status(201).json({ message: response });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Messaggio non valido.' });
    }
    next(error);
  }
});

// Voice call routes
router.post('/threads/:threadId/call/start', requireAuth, async (req, res, next) => {
  try {
    const ensured = await ensureThreadForUser(req.params.threadId, req.user);
    if (!ensured) return res.status(404).json({ message: 'Conversazione non trovata.' });
    const { thread, isMaster, isCustomer } = ensured;

    if (!isMaster && !isCustomer) {
      return res.status(403).json({ message: 'Accesso non consentito.' });
    }

    const now = new Date();
    if (thread.expires_at && thread.expires_at <= now) {
      return res.status(403).json({ message: 'Il tempo a disposizione per la chat è terminato.' });
    }

    // Check if there's already an active call
    const existingCall = await ChatCall.findOne({
      thread_id: thread._id,
      status: { $in: ['calling', 'accepted'] }
    });

    if (existingCall) {
      return res.status(409).json({ message: 'C\'è già una chiamata attiva per questa conversazione.' });
    }

    const calleeId = isMaster ? thread.customer_id : thread.master_user_id;
    
    const call = await ChatCall.create({
      thread_id: thread._id,
      caller_id: req.user._id,
      callee_id: calleeId,
      status: 'calling'
    });

    // Emit call event to both users
    const callData = {
      callId: call._id,
      threadId: thread._id,
      callerId: req.user._id,
      calleeId: calleeId,
      callerName: isMaster ? thread.master_id?.display_name : resolveDisplayName(thread.customer_id),
      status: 'calling'
    };

    emitToUser(calleeId, 'chat:call:incoming', callData);
    emitToUser(req.user._id, 'chat:call:outgoing', callData);

    // Auto-timeout after 30 seconds
    setTimeout(async () => {
      try {
        const timeoutCall = await ChatCall.findById(call._id);
        if (timeoutCall && timeoutCall.status === 'calling') {
          timeoutCall.status = 'timeout';
          await timeoutCall.save();
          
          emitToUser(calleeId, 'chat:call:timeout', { callId: call._id, threadId: thread._id });
          emitToUser(req.user._id, 'chat:call:timeout', { callId: call._id, threadId: thread._id });
        }
      } catch (error) {
        console.error('Call timeout error:', error);
      }
    }, 30000);

    res.json({ call: callData });
  } catch (error) {
    next(error);
  }
});

router.post('/threads/:threadId/call/:callId/accept', requireAuth, async (req, res, next) => {
  try {
    const ensured = await ensureThreadForUser(req.params.threadId, req.user);
    if (!ensured) return res.status(404).json({ message: 'Conversazione non trovata.' });

    const call = await ChatCall.findById(req.params.callId);
    if (!call || call.thread_id.toString() !== req.params.threadId) {
      return res.status(404).json({ message: 'Chiamata non trovata.' });
    }

    if (call.callee_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Non puoi accettare questa chiamata.' });
    }

    if (call.status !== 'calling') {
      return res.status(409).json({ message: 'La chiamata non è più disponibile.' });
    }

    call.status = 'accepted';
    call.started_at = new Date();
    await call.save();

    const callData = {
      callId: call._id,
      threadId: call.thread_id,
      status: 'accepted',
      startedAt: call.started_at
    };

    emitToUser(call.caller_id, 'chat:call:accepted', callData);
    emitToUser(call.callee_id, 'chat:call:accepted', callData);

    res.json({ call: callData });
  } catch (error) {
    next(error);
  }
});

router.post('/threads/:threadId/call/:callId/reject', requireAuth, async (req, res, next) => {
  try {
    const ensured = await ensureThreadForUser(req.params.threadId, req.user);
    if (!ensured) return res.status(404).json({ message: 'Conversazione non trovata.' });

    const call = await ChatCall.findById(req.params.callId);
    if (!call || call.thread_id.toString() !== req.params.threadId) {
      return res.status(404).json({ message: 'Chiamata non trovata.' });
    }

    if (call.callee_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Non puoi rifiutare questa chiamata.' });
    }

    if (call.status !== 'calling') {
      return res.status(409).json({ message: 'La chiamata non è più disponibile.' });
    }

    call.status = 'rejected';
    await call.save();

    const callData = {
      callId: call._id,
      threadId: call.thread_id,
      status: 'rejected'
    };

    emitToUser(call.caller_id, 'chat:call:rejected', callData);
    emitToUser(call.callee_id, 'chat:call:rejected', callData);

    res.json({ call: callData });
  } catch (error) {
    next(error);
  }
});

router.post('/threads/:threadId/call/:callId/end', requireAuth, async (req, res, next) => {
  try {
    const ensured = await ensureThreadForUser(req.params.threadId, req.user);
    if (!ensured) return res.status(404).json({ message: 'Conversazione non trovata.' });

    const call = await ChatCall.findById(req.params.callId);
    if (!call || call.thread_id.toString() !== req.params.threadId) {
      return res.status(404).json({ message: 'Chiamata non trovata.' });
    }

    const isParticipant = call.caller_id.toString() === req.user._id.toString() || 
                        call.callee_id.toString() === req.user._id.toString();
    
    if (!isParticipant) {
      return res.status(403).json({ message: 'Non puoi terminare questa chiamata.' });
    }

    if (call.status === 'ended') {
      return res.status(409).json({ message: 'La chiamata è già terminata.' });
    }

    const endTime = new Date();
    call.status = 'ended';
    call.ended_at = endTime;
    
    if (call.started_at) {
      call.duration_s = Math.floor((endTime - call.started_at) / 1000);
    }
    
    await call.save();

    const callData = {
      callId: call._id,
      threadId: call.thread_id,
      status: 'ended',
      duration: call.duration_s
    };

    emitToUser(call.caller_id, 'chat:call:ended', callData);
    emitToUser(call.callee_id, 'chat:call:ended', callData);

    res.json({ call: callData });
  } catch (error) {
    next(error);
  }
});

// WebRTC signaling
router.post('/threads/:threadId/call/:callId/signal', requireAuth, async (req, res, next) => {
  try {
    const { type, data } = req.body;
    
    if (!['offer', 'answer', 'ice-candidate'].includes(type)) {
      return res.status(400).json({ message: 'Tipo di segnale non valido.' });
    }

    const ensured = await ensureThreadForUser(req.params.threadId, req.user);
    if (!ensured) return res.status(404).json({ message: 'Conversazione non trovata.' });

    const call = await ChatCall.findById(req.params.callId);
    if (!call || call.thread_id.toString() !== req.params.threadId) {
      return res.status(404).json({ message: 'Chiamata non trovata.' });
    }

    const isParticipant = call.caller_id.toString() === req.user._id.toString() || 
                        call.callee_id.toString() === req.user._id.toString();
    
    if (!isParticipant) {
      return res.status(403).json({ message: 'Non autorizzato per questa chiamata.' });
    }

    if (call.status !== 'accepted') {
      return res.status(409).json({ message: 'La chiamata non è attiva.' });
    }

    // Send signal to the other participant
    const targetUserId = call.caller_id.toString() === req.user._id.toString() 
      ? call.callee_id 
      : call.caller_id;

    emitToUser(targetUserId, 'chat:call:signal', {
      callId: call._id,
      threadId: call.thread_id,
      type,
      data,
      from: req.user._id
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
