import { Router } from 'express';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { User } from '../models/user.model.js';
import { Wallet } from '../models/wallet.model.js';
import { sendMail } from '../lib/mailer.js';

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

const router = Router();

router.post('/signup', async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      phone: Joi.string().allow(''),
      password: Joi.string().min(6).required(),
      firstName: Joi.string().max(80).allow('', null),
      lastName: Joi.string().max(80).allow('', null)
    });
    const payload = await schema.validateAsync(req.body);
    const exists = await User.findOne({ email: payload.email });
    if (exists) return res.status(400).json({ message: 'Email already in use' });

    const wallet = await Wallet.create({});
    const user = await User.create({
      email: payload.email,
      phone: payload.phone,
      password: payload.password,
      wallet_id: wallet._id,
      first_name: payload.firstName,
      last_name: payload.lastName,
      display_name: [payload.firstName, payload.lastName].filter(Boolean).join(' ') || undefined
    });
    wallet.owner_id = user._id; await wallet.save();

    const verificationToken = user.createEmailVerification();
    await user.save();

    const appUrl = (process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const verifyLink = `${appUrl}/verify-email?token=${verificationToken}`;

    const heroColor = '#6d5bff';
    const html = `
      <table role="presentation" style="width:100%;background:#040612;padding:40px 0;font-family:'Manrope',system-ui,sans-serif;color:#f6f8ff;">
        <tr>
          <td>
            <table role="presentation" style="width:520px;margin:0 auto;background:rgba(10,16,26,0.92);border-radius:28px;padding:48px;border:1px solid rgba(123,139,188,0.2);">
              <tr>
                <td style="text-align:center;padding-bottom:32px;">
                  <div style="display:inline-flex;align-items:center;gap:12px;">
                    <span style="font-size:24px;font-weight:800;color:${heroColor};">Rivelya</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#f6f8ff;">Conferma il tuo account</h1>
                  <p style="margin:0;color:#98a5c7;font-size:16px;line-height:1.6;">
                    Ciao ${payload.firstName || ''}! Grazie per aver scelto Rivelya.
                    Per completare la registrazione e iniziare a scoprire i nostri master,
                    clicca sul pulsante qui sotto.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:36px;text-align:center;">
                  <a href="${verifyLink}" style="display:inline-block;padding:14px 28px;background:${heroColor};color:#040612;font-weight:700;border-radius:999px;text-decoration:none;">Attiva il mio account</a>
                </td>
              </tr>
              <tr>
                <td style="color:#98a5c7;font-size:14px;line-height:1.6;">
                  <p style="margin:0 0 12px;">Oppure copia e incolla questo link nel browser:</p>
                  <p style="word-break:break-all;margin:0;"><a href="${verifyLink}" style="color:${heroColor};text-decoration:none;">${verifyLink}</a></p>
                </td>
              </tr>
              <tr>
                <td style="padding-top:32px;color:#5f6b88;font-size:12px;text-align:center;">
                  Questo link è valido per 24 ore. Se non hai richiesto questo account, ignora questa email.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;

    await sendMail({ to: user.email, subject: 'Conferma la tua email Rivelya', html });

    res.status(201).json({
      message: 'Registrazione completata. Controlla la tua email per confermare l\'account.'
    });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    });
    const { email, password } = await schema.validateAsync(req.body);
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.is_email_verified) {
      return res.status(403).json({ message: 'Verifica la tua email per accedere.' });
    }
    const token = jwt.sign({ sub: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ token, user: serializeUser(user) });
  } catch (e) { next(e); }
});

router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ message: 'Token mancante' });
    const user = await User.findOne({
      email_verification_token: token,
      email_verification_expires: { $gt: new Date() }
    });
    if (!user) return res.status(400).json({ message: 'Link non valido o scaduto.' });
    user.clearEmailVerification();
    await user.save();
    const authToken = jwt.sign({ sub: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ token: authToken, user: serializeUser(user) });
  } catch (e) { next(e); }
});

export default router;
