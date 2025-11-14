import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middleware/auth.js';
import { ChatThread } from '../models/chat-thread.model.js';
import { ChatMessage } from '../models/chat-message.model.js';
import { Master } from '../models/master.model.js';
import { emitToUser } from '../lib/socket.js';
import { ChatThreadNote } from '../models/chat-thread-note.model.js';

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
    master: thread.master_id ? {
      id: thread.master_id._id,
      name: thread.master_id.display_name,
      userId: thread.master_user_id?._id || thread.master_user_id,
      avatarUrl: thread.master_user_id?.avatar_url || null,
      phoneRateCpm: typeof thread.master_id.rate_phone_cpm === 'number'
        ? thread.master_id.rate_phone_cpm
        : null,
      chatRateCpm: typeof thread.master_id.rate_chat_cpm === 'number'
        ? thread.master_id.rate_chat_cpm
        : null
    } : null,
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

const ensureThreadForUser = async (threadId, user) => {
  const thread = await ChatThread.findById(threadId)
    .populate('booking_id', 'date start_time end_time channel status')
    .populate('master_id', 'display_name rate_phone_cpm rate_chat_cpm')
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
      .populate('master_id', 'display_name rate_phone_cpm rate_chat_cpm')
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
      noteUpdatedAt: note?.updatedAt || null
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

    res.status(201).json({ message: response });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Messaggio non valido.' });
    }
    next(error);
  }
});

export default router;
