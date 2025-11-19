import { emitToUser } from '../lib/socket.js';

export const emitSessionStatus = ({ sessionId, channel, status, userId, masterUserId }) => {
  if (!sessionId || !status) return;
  const payload = {
    sessionId: sessionId.toString(),
    channel,
    status
  };

  [userId, masterUserId]
    .map(id => (id ? id.toString() : null))
    .filter(Boolean)
    .forEach(target => emitToUser(target, 'session:status', payload));
};
