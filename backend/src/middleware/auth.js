import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.sub).select('-password');
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    req.user = user;
    next();
  } catch (e) {
    next({ status: 401, message: 'Unauthorized' });
  }
};

export const requireRole = role => (req, res, next) => {
  if (!req.user || !req.user.roles?.includes(role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};
