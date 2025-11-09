import { Router } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/user.model.js';
import { deleteFromS3, uploadToS3 } from '../lib/s3.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const profileSchema = Joi.object({
  firstName: Joi.string().max(80).allow('', null),
  lastName: Joi.string().max(80).allow('', null),
  displayName: Joi.string().max(120).allow('', null),
  phone: Joi.string().max(40).allow('', null),
  locale: Joi.string().max(10).allow('', null),
  bio: Joi.string().max(600).allow('', null),
  location: Joi.string().max(120).allow('', null)
});

const serializeUser = user => ({
  id: user._id,
  email: user.email,
  roles: user.roles,
  phone: user.phone || '',
  firstName: user.first_name || '',
  lastName: user.last_name || '',
  displayName: user.display_name || '',
  locale: user.locale,
  bio: user.bio || '',
  location: user.location || '',
  avatarUrl: user.avatar_url || '',
  isEmailVerified: user.is_email_verified
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });
    res.json({ user: serializeUser(user) });
  } catch (e) {
    next(e);
  }
});

router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const payload = await profileSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    const firstName = payload.firstName?.trim() ?? '';
    const lastName = payload.lastName?.trim() ?? '';
    const displayName = payload.displayName?.trim();
    user.first_name = firstName;
    user.last_name = lastName;
    user.display_name = displayName || [firstName, lastName].filter(Boolean).join(' ');
    user.phone = payload.phone?.trim() ?? '';
    if (payload.locale) user.locale = payload.locale;
    user.bio = payload.bio?.trim() ?? '';
    user.location = payload.location?.trim() ?? '';

    await user.save();
    res.json({ user: serializeUser(user) });
  } catch (e) {
    if (e.isJoi) {
      return res.status(400).json({ message: 'Dati non validi', details: e.details });
    }
    next(e);
  }
});

router.post('/me/avatar', requireAuth, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Nessun file caricato' });
    if (!/^image\//.test(req.file.mimetype)) {
      return res.status(400).json({ message: 'Formato immagine non supportato' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    const key = `avatars/${user._id}/${Date.now()}-${randomUUID()}`;
    const { url } = await uploadToS3({
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype
    });

    if (user.avatar_key && user.avatar_key !== key) {
      await deleteFromS3(user.avatar_key);
    }

    user.avatar_key = key;
    user.avatar_url = url;
    await user.save();

    res.json({ user: serializeUser(user) });
  } catch (e) {
    next(e);
  }
});

router.delete('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });
    if (user.avatar_key) {
      await deleteFromS3(user.avatar_key);
      user.avatar_key = undefined;
      user.avatar_url = undefined;
      await user.save();
    }
    res.json({ user: serializeUser(user) });
  } catch (e) {
    next(e);
  }
});

export default router;
