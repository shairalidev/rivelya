import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middleware/auth.js';
import { Notification } from '../models/notification.model.js';

const router = Router();

const readSchema = Joi.object({
  ids: Joi.array().items(Joi.string().hex().length(24)).min(1).required()
});

const serialize = notification => ({
  id: notification._id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  meta: notification.meta || {},
  createdAt: notification.createdAt,
  readAt: notification.read_at
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user_id: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ notifications: notifications.map(serialize) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      { read_at: new Date() },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notifica non trovata.' });
    }
    res.json({ notification: serialize(notification) });
  } catch (error) {
    next(error);
  }
});

router.post('/read', requireAuth, async (req, res, next) => {
  try {
    const payload = await readSchema.validateAsync(req.body);
    await Notification.updateMany(
      { _id: { $in: payload.ids }, user_id: req.user._id },
      { read_at: new Date() }
    );
    res.json({ status: 'ok' });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Richiesta non valida.' });
    }
    next(error);
  }
});

export default router;
