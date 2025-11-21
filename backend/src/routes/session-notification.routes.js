import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middleware/auth.js';
import { SessionNotification } from '../models/session-notification.model.js';
import { Master } from '../models/master.model.js';

const router = Router();

const subscribeSchema = Joi.object({
  master_id: Joi.string().hex().length(24).required()
});

// Subscribe to notifications when expert's session ends
router.post('/subscribe', requireAuth, async (req, res, next) => {
  try {
    const { master_id } = await subscribeSchema.validateAsync(req.body);
    
    // Check if master exists
    const master = await Master.findById(master_id);
    if (!master) {
      return res.status(404).json({ message: 'Esperti non trovato.' });
    }

    // Create or update subscription
    await SessionNotification.findOneAndUpdate(
      { user_id: req.user._id, master_id },
      { active: true },
      { upsert: true, new: true }
    );

    res.json({ message: 'Ti avviseremo quando l\'esperti sarà disponibile.' });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Richiesta non valida.' });
    }
    next(error);
  }
});

// Unsubscribe from notifications
router.post('/unsubscribe', requireAuth, async (req, res, next) => {
  try {
    const { master_id } = await subscribeSchema.validateAsync(req.body);
    
    await SessionNotification.findOneAndUpdate(
      { user_id: req.user._id, master_id },
      { active: false },
      { new: true }
    );

    res.json({ message: 'Notifiche disattivate per questo esperti.' });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Richiesta non valida.' });
    }
    next(error);
  }
});

// Check subscription status
router.get('/status/:master_id', requireAuth, async (req, res, next) => {
  try {
    const subscription = await SessionNotification.findOne({
      user_id: req.user._id,
      master_id: req.params.master_id,
      active: true
    });

    res.json({ subscribed: !!subscription });
  } catch (error) {
    next(error);
  }
});

export default router;