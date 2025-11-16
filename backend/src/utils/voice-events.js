import { emitToUser } from '../services/socket.service.js';
import { createNotification } from './notifications.js';

const channelLabels = {
  voice: 'vocale',
  chat_voice: 'chat + voce'
};

const resolveDisplayName = user => {
  if (!user) return 'Un cliente';
  return (
    user.display_name
    || [user.first_name, user.last_name].filter(Boolean).join(' ')
    || 'Un cliente'
  );
};

const sessionPayload = session => ({
  sessionId: session._id,
  channel: session.channel,
  status: session.status,
  createdAt: session.createdAt,
  expiresAt: session.end_ts
});

export const notifyVoiceSessionCreated = async ({ session, customerUser, masterUserId }) => {
  try {
    const payload = {
      ...sessionPayload(session),
      createdBy: customerUser?._id || customerUser || null
    };

    if (customerUser?._id) {
      emitToUser(customerUser._id, 'voice:session:created', payload);
    } else if (customerUser) {
      emitToUser(customerUser, 'voice:session:created', payload);
    }

    if (masterUserId) {
      emitToUser(masterUserId, 'voice:session:created', payload);
    }

    if (masterUserId) {
      const channelLabel = channelLabels[session.channel] || 'vocale';
      const displayName = resolveDisplayName(customerUser);
      await createNotification({
        userId: masterUserId,
        type: 'voice:session:created',
        title: 'Nuova sessione vocale',
        body: `${displayName} ha avviato una sessione ${channelLabel}.`,
        meta: { sessionId: session._id, channel: session.channel }
      });
    }
  } catch (error) {
    console.error('Failed to notify voice session creation', error);
  }
};
