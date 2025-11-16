import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { allowedOrigins } from '../app.js';
import { User } from '../models/user.model.js';

let ioInstance = null;

const normalizeUserId = userId => {
  if (!userId) return null;
  if (typeof userId === 'string') return userId;

  if (typeof userId === 'object') {
    if (typeof userId.toHexString === 'function') {
      return userId.toHexString();
    }
    if (userId._id) {
      return normalizeUserId(userId._id);
    }
  }

  if (typeof userId === 'number') {
    return userId.toString();
  }

  if (typeof userId === 'bigint') {
    return userId.toString();
  }

  if (typeof userId.toString === 'function') {
    return userId.toString();
  }

  return null;
};

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
    
    // Handle voice session events
    socket.on('voice:session:join', (data) => {
      if (data.sessionId) {
        socket.join(`session:${data.sessionId}`);
      }
    });
    
    socket.on('voice:session:leave', (data) => {
      if (data.sessionId) {
        socket.leave(`session:${data.sessionId}`);
      }
    });
    
    socket.on('voice:mute:toggle', (data) => {
      if (data.sessionId) {
        // Broadcast mute status to other participants in the session
        socket.to(`session:${data.sessionId}`).emit('voice:participant:muted', {
          userId,
          isMuted: data.isMuted,
          sessionId: data.sessionId
        });
      }
    });
    
    socket.on('disconnect', () => {
      // Clean up any session rooms when user disconnects
    });
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
  if (!ioInstance) return;
  const target = normalizeUserId(userId);
  if (!target) return;
  ioInstance.to(`user:${target}`).emit(event, payload);
};
