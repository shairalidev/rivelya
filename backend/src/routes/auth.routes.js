import { Router } from 'express';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { User } from '../models/user.model.js';
import { Wallet } from '../models/wallet.model.js';

const router = Router();

router.post('/signup', async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      phone: Joi.string().allow(''),
      password: Joi.string().min(6).required()
    });
    const payload = await schema.validateAsync(req.body);
    const exists = await User.findOne({ email: payload.email });
    if (exists) return res.status(400).json({ message: 'Email already in use' });

    const wallet = await Wallet.create({});
    const user = await User.create({ ...payload, wallet_id: wallet._id });
    wallet.owner_id = user._id; await wallet.save();

    const token = jwt.sign({ sub: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ token, user: { id: user._id, email: user.email, roles: user.roles } });
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
    const token = jwt.sign({ sub: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ token, user: { id: user._id, email: user.email, roles: user.roles } });
  } catch (e) { next(e); }
});

export default router;
