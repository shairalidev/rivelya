import { Router } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/user.model.js';
import { Master } from '../models/master.model.js';
import { deleteFromS3, uploadToS3 } from '../lib/s3.js';
import { cacheMediaBuffer, purgeCachedMedia } from '../lib/media-cache.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const profileSchema = Joi.object({
  firstName: Joi.string().max(80).allow('', null),
  lastName: Joi.string().max(80).allow('', null),
  displayName: Joi.string().max(120).allow('', null),
  phone: Joi.string().max(40).allow('', null),
  locale: Joi.string().max(10).allow('', null),
  bio: Joi.string().max(600).allow('', null),
  location: Joi.string().max(120).allow('', null),
  taxCode: Joi.string().max(16).allow('', null),
  vatNumber: Joi.string().max(11).allow('', null),

  birthPlace: Joi.string().max(120).allow('', null),
  birthProvince: Joi.string().max(80).allow('', null),
  birthCountry: Joi.string().max(80).allow('', null),
  address: Joi.string().max(200).allow('', null),
  zipCode: Joi.string().max(20).allow('', null),
  city: Joi.string().max(120).allow('', null),
  province: Joi.string().max(120).allow('', null),
  country: Joi.string().max(120).allow('', null),
  iban: Joi.string().max(34).allow('', null),
  taxRegime: Joi.string().valid('forfettario', 'ordinario', 'ritenuta_acconto').allow(null),
  horoscopeBirthDate: Joi.date().allow(null),
  horoscopeBirthTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).allow('', null)
});

const serializeUser = user => ({
  id: user._id,
  user_id: user._id,
  email: user.email,
  roles: user.roles,
  phone: user.phone || '',
  firstName: user.first_name || '',
  lastName: user.last_name || '',
  displayName: user.display_name || '',
  locale: user.locale,
  bio: user.bio || '',
  location: user.location || '',
  taxCode: user.tax_code || '',
  vatNumber: user.vat_number || '',

  birthPlace: user.birth_place || '',
  birthProvince: user.birth_province || '',
  birthCountry: user.birth_country || '',
  address: user.address || '',
  zipCode: user.zip_code || '',
  city: user.city || '',
  province: user.province || '',
  country: user.country || '',
  iban: user.iban || '',
  taxRegime: user.tax_regime || 'forfettario',
  horoscopeBirthDate: user.horoscope_birth_date || null,
  horoscopeBirthTime: user.horoscope_birth_time || '',
  avatarUrl: user.avatar_url || '',
  isEmailVerified: user.is_email_verified
});

const decorateWithMaster = async user => {
  const payload = serializeUser(user);
  if (user.roles?.includes('master')) {
    const master = await Master.findOne({ user_id: user._id }).select('_id');
    if (master) payload.masterId = master._id;
  }
  return payload;
};

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });
    res.json({ user: await decorateWithMaster(user) });
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
    user.tax_code = payload.taxCode?.trim() ?? '';
    user.vat_number = payload.vatNumber?.trim() ?? '';
    user.birth_date = payload.horoscopeBirthDate || null;
    user.birth_place = payload.birthPlace?.trim() ?? '';
    user.birth_province = payload.birthProvince?.trim() ?? '';
    user.birth_country = payload.birthCountry?.trim() ?? '';
    user.address = payload.address?.trim() ?? '';
    user.zip_code = payload.zipCode?.trim() ?? '';
    user.city = payload.city?.trim() ?? '';
    user.province = payload.province?.trim() ?? '';
    user.country = payload.country?.trim() ?? '';
    user.iban = payload.iban?.trim() ?? '';
    if (payload.taxRegime) user.tax_regime = payload.taxRegime;
    user.horoscope_birth_date = payload.horoscopeBirthDate || null;
    user.horoscope_birth_time = payload.horoscopeBirthTime?.trim() ?? '';

    await user.save();
    
    // Sync display_name with Master model if user is a master
    if (user.roles?.includes('master')) {
      await Master.findOneAndUpdate(
        { user_id: user._id },
        { display_name: user.display_name }
      );
    }
    
    res.json({ user: await decorateWithMaster(user) });
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

    await cacheMediaBuffer(key, req.file.buffer);

    if (user.avatar_key && user.avatar_key !== key) {
      await deleteFromS3(user.avatar_key);
      await purgeCachedMedia(user.avatar_key);
    }

    user.avatar_key = key;
    user.avatar_url = url;
    await user.save();

    res.json({ user: await decorateWithMaster(user) });
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
      await purgeCachedMedia(user.avatar_key);
      user.avatar_key = undefined;
      user.avatar_url = undefined;
      await user.save();
    }
    res.json({ user: await decorateWithMaster(user) });
  } catch (e) {
    next(e);
  }
});

router.get('/clients/:id', requireAuth, async (req, res, next) => {
  try {
    if (!req.user.roles?.includes('master')) {
      return res.status(403).json({ message: 'Solo i master possono visualizzare i profili cliente.' });
    }

    const client = await User.findById(req.params.id).select(
      'first_name last_name display_name avatar_url locale bio horoscope_birth_date horoscope_birth_time'
    );

    if (!client) return res.status(404).json({ message: 'Cliente non trovato' });

    res.json({
      client: {
        id: client._id,
        displayName: client.display_name
          || [client.first_name, client.last_name].filter(Boolean).join(' ')
          || 'Cliente',
        avatarUrl: client.avatar_url || '',
        locale: client.locale || 'it-IT',
        bio: client.bio || '',
        horoscopeBirthDate: client.horoscope_birth_date || null,
        horoscopeBirthTime: client.horoscope_birth_time || ''
      }
    });
  } catch (e) {
    next(e);
  }
});

export default router;
