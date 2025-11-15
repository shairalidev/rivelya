import { emitToUser as emitToUserBase, getIO } from '../lib/socket.js';

const withIO = callback => {
  try {
    const io = getIO();
    callback(io);
  } catch {
    // Socket server not ready yet; ignore emit attempts.
  }
};

export const emitToUser = (userId, event, data) => {
  emitToUserBase(userId, event, data);
};

export const emitToSession = (sessionId, event, data) => {
  withIO(io => {
    io.to(`session:${sessionId}`).emit(event, data);
  });
};

export const emitToRoom = (room, event, data) => {
  withIO(io => {
    io.to(room).emit(event, data);
  });
};

// Backwards compatible no-op functions kept for legacy imports
export const addUser = () => {};
export const removeUser = () => {};
export const joinSession = () => {};
export const leaveSession = () => {};
