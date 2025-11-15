const connectedUsers = new Map();
const userSessions = new Map(); // userId -> Set of sessionIds

export const addUser = (userId, socketId) => {
  connectedUsers.set(userId.toString(), socketId);
};

export const removeUser = (userId) => {
  connectedUsers.delete(userId.toString());
  userSessions.delete(userId.toString());
};

export const joinSession = (userId, sessionId) => {
  const userIdStr = userId.toString();
  if (!userSessions.has(userIdStr)) {
    userSessions.set(userIdStr, new Set());
  }
  userSessions.get(userIdStr).add(sessionId.toString());
};

export const leaveSession = (userId, sessionId) => {
  const userIdStr = userId.toString();
  const sessions = userSessions.get(userIdStr);
  if (sessions) {
    sessions.delete(sessionId.toString());
  }
};

export const emitToUser = (userId, event, data) => {
  const socketId = connectedUsers.get(userId.toString());
  if (socketId && global.io) {
    global.io.to(socketId).emit(event, data);
  }
};

export const emitToSession = (sessionId, event, data) => {
  if (global.io) {
    global.io.to(`session:${sessionId}`).emit(event, data);
  }
};

export const emitToRoom = (room, event, data) => {
  if (global.io) {
    global.io.to(room).emit(event, data);
  }
};