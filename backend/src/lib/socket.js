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
      const origin = socket.handshake.headers?.origin || socket.handshake.headers?.host || 'unknown';
      console.info('[voice] Incoming socket handshake', {
        origin,
        hasToken: Boolean(token)
      });

      if (!token) {
        console.warn('[voice] Rejecting socket handshake - missing token');
        return next(new Error('Unauthorized'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.sub).select('_id roles');
      if (!user) {
        console.warn('[voice] Rejecting socket handshake - user not found', { userId: decoded.sub });
        return next(new Error('Unauthorized'));
      }
      socket.data.user = user;
      console.info('[voice] Socket authenticated', { userId: user._id.toString() });
      return next();
    } catch (error) {
      console.warn('[voice] Socket authentication error', { message: error.message });
      return next(new Error('Unauthorized'));
    }
  });

  ioInstance.on('connection', socket => {
    const userId = socket.data.user._id.toString();
    socket.join(`user:${userId}`);
    console.info('[voice] Socket connected and joined personal room', { userId, socketId: socket.id });

    // Handle voice session events (legacy - keeping for compatibility)
    socket.on('voice:session:join', (data) => {
      if (data.sessionId) {
        socket.join(`session:${data.sessionId}`);
        console.info('[voice] User joined voice session room', { userId, sessionId: data.sessionId });
      }
    });

    socket.on('voice:session:leave', (data) => {
      if (data.sessionId) {
        socket.leave(`session:${data.sessionId}`);
        console.info('[voice] User left voice session room', { userId, sessionId: data.sessionId });
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
        console.info('[voice] User toggled mute status', { userId, sessionId: data.sessionId, isMuted: data.isMuted });
      }
    });

    // Handle chat call events
    socket.on('chat:call:join', (data) => {
      if (data.callId) {
        socket.join(`call:${data.callId}`);
        console.info('[chat] User joined call room', { userId, callId: data.callId });
      }
    });

    socket.on('chat:call:leave', (data) => {
      if (data.callId) {
        socket.leave(`call:${data.callId}`);
        console.info('[chat] User left call room', { userId, callId: data.callId });
      }
    });

    // Handle WebRTC signaling for chat calls
    socket.on('chat:call:webrtc:signal', (data) => {
      const { callId, threadId, type, signalData, targetUserId } = data;
      if (callId && threadId && type && signalData && targetUserId) {
        console.info('[chat] Relaying WebRTC signal', { userId, callId, type, targetUserId });
        socket.to(`user:${targetUserId}`).emit('chat:call:signal', {
          callId,
          threadId,
          type,
          data: signalData,
          from: userId
        });
      }
    });

    // Handle WebRTC signaling for voice sessions
    socket.on('voice:webrtc:signal', (data) => {
      const { sessionId, type, signalData, targetUserId } = data;
      if (sessionId && type && signalData && targetUserId) {
        console.info('[voice] Relaying WebRTC signal', { userId, sessionId, type, targetUserId });
        socket.to(`user:${targetUserId}`).emit('voice:webrtc:signal', {
          sessionId,
          type,
          data: signalData,
          from: userId
        });
      }
    });

    socket.on('disconnect', (reason) => {
      // Clean up any session rooms when user disconnects
      console.info('[voice] Socket disconnected', { userId, socketId: socket.id, reason });
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
