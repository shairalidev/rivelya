import { Router } from 'express';
import Joi from 'joi';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Master } from '../models/master.model.js';

const router = Router();

const serializeMaster = master => ({
  id: master._id,
  displayName: master.display_name || '',
  headline: master.headline || '',
  bio: master.bio || '',
  categories: master.categories || [],
  specialties: master.specialties || [],
  languages: master.languages || [],
  experienceYears: master.experience_years || 0,
  rateChatCpm: master.rate_chat_cpm ?? 0,
  ratePhoneCpm: master.rate_phone_cpm ?? 0,
  rateVideoCpm: master.rate_video_cpm ?? 0,
  services: {
    chat: master.services?.chat !== false,
    phone: master.services?.phone !== false,
    video: Boolean(master.services?.video)
  },
  media: {
    avatarUrl: master.media?.avatar_url || '',
    introVideoUrl: master.media?.intro_video_url || ''
  }
});

const updateSchema = Joi.object({
  displayName: Joi.string().max(120).allow('', null),
  headline: Joi.string().max(160).allow('', null),
  bio: Joi.string().max(1200).allow('', null),
  categories: Joi.array().items(Joi.string().trim().max(80)).max(8),
  specialties: Joi.array().items(Joi.string().trim().max(80)).max(12),
  languages: Joi.array().items(Joi.string().trim().max(16)).max(8),
  experienceYears: Joi.number().integer().min(0).max(80).allow(null),
  avatarUrl: Joi.string().uri().allow('', null),
  introVideoUrl: Joi.string().uri().allow('', null),
  services: Joi.object({
    chat: Joi.boolean(),
    phone: Joi.boolean(),
    video: Joi.boolean()
  }).default({}),
  rates: Joi.object({
    chat: Joi.number().integer().min(0),
    phone: Joi.number().integer().min(0),
    video: Joi.number().integer().min(0)
  }).default({})
});

const ensureMasterAccount = async userId => Master.findOne({ user_id: userId });

router.get('/me', requireAuth, requireRole('master'), async (req, res, next) => {
  try {
    const master = await ensureMasterAccount(req.user._id);
    if (!master) return res.status(404).json({ message: 'Profilo master non trovato.' });
    res.json({ master: serializeMaster(master) });
  } catch (error) {
    next(error);
  }
});

router.put('/me', requireAuth, requireRole('master'), async (req, res, next) => {
  try {
    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const master = await ensureMasterAccount(req.user._id);
    if (!master) return res.status(404).json({ message: 'Profilo master non trovato.' });

    if (payload.displayName !== undefined) {
      master.display_name = payload.displayName?.trim() || '';
    }
    if (payload.headline !== undefined) {
      master.headline = payload.headline?.trim() || '';
    }
    if (payload.bio !== undefined) {
      master.bio = payload.bio?.trim() || '';
    }
    if (payload.categories) {
      master.categories = payload.categories.map(value => value.trim()).filter(Boolean);
    }
    if (payload.specialties) {
      master.specialties = payload.specialties.map(value => value.trim()).filter(Boolean);
    }
    if (payload.languages) {
      master.languages = payload.languages.map(value => value.trim()).filter(Boolean);
    }
    if (payload.experienceYears !== undefined) {
      master.experience_years = payload.experienceYears ?? 0;
    }
    if (payload.avatarUrl !== undefined || payload.introVideoUrl !== undefined) {
      master.media = master.media || {};
      if (payload.avatarUrl !== undefined) {
        master.media.avatar_url = payload.avatarUrl?.trim() || '';
      }
      if (payload.introVideoUrl !== undefined) {
        master.media.intro_video_url = payload.introVideoUrl?.trim() || '';
      }
    }
    if (payload.services) {
      master.services = {
        chat: payload.services.chat !== undefined ? payload.services.chat : master.services?.chat !== false,
        phone: payload.services.phone !== undefined ? payload.services.phone : master.services?.phone !== false,
        video: payload.services.video !== undefined ? payload.services.video : Boolean(master.services?.video)
      };
    }
    if (payload.rates) {
      if (payload.rates.chat != null) master.rate_chat_cpm = payload.rates.chat;
      if (payload.rates.phone != null) master.rate_phone_cpm = payload.rates.phone;
      if (payload.rates.video != null) master.rate_video_cpm = payload.rates.video;
    }

    await master.save();
    res.json({ master: serializeMaster(master) });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ message: 'Dati non validi', details: error.details });
    }
    next(error);
  }
});

export default router;
