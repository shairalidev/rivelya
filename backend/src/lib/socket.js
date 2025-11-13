import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { allowedOrigins } from '../app.js';
import { User } from '../models/user.model.js';

let ioInstance = null;

export const initSocket = server => {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(server, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
      credentials: true
    }
  });

  ioInstance.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Unauthorized'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.sub).select('_id roles');
      if (!user) return next(new Error('Unauthorized'));
      socket.data.user = user;
      return next();
    } catch (error) {
      return next(new Error('Unauthorized'));
    }
  });

  ioInstance.on('connection', socket => {
    const userId = socket.data.user._id.toString();
    socket.join(`user:${userId}`);
  });

  return ioInstance;
};

export const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io not initialized');
  }
  return ioInstance;
};

export const emitToUser = (userId, event, payload) => {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId.toString()}`).emit(event, payload);
};
