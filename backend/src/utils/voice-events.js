import { emitToUser } from '../services/socket.service.js';
import { createNotification } from './notifications.js';

const channelLabels = {
  voice: 'vocale',
  chat_voice: 'chat e voce'
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

const normalizeId = value => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toString === 'function') return value.toString();
  return null;
};

const extractUserId = ref => {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (ref._id) return ref._id;
  return ref;
};

const resolveMasterName = session => session.master_id?.display_name || 'Esperti Rivelya';

const resolveCustomerName = session => resolveDisplayName(session.user_id);

const buildNotificationMeta = session => ({
  sessionId: session._id,
  channel: session.channel
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

const buildStartBodies = (session, startedBy) => {
  const channelLabel = channelLabels[session.channel] || 'vocale';
  const masterName = resolveMasterName(session);
  const customerName = resolveCustomerName(session);
  const customerId = extractUserId(session.user_id);
  const masterUserId = extractUserId(session.master_id?.user_id);
  const startedById = normalizeId(startedBy);
  const startedByCustomer = customerId && normalizeId(customerId) === startedById;
  const startedByMaster = masterUserId && normalizeId(masterUserId) === startedById;

  return {
    customerBody: startedByCustomer
      ? `Hai avviato una sessione ${channelLabel} con ${masterName}.`
      : `${masterName} ha avviato una sessione ${channelLabel}.`,
    masterBody: startedByMaster
      ? `Hai avviato una sessione ${channelLabel} con ${customerName}.`
      : `${customerName} ha avviato una sessione ${channelLabel}.`
  };
};

const buildEndBodies = (session, endedBy) => {
  const channelLabel = channelLabels[session.channel] || 'vocale';
  const masterName = resolveMasterName(session);
  const customerName = resolveCustomerName(session);
  const customerId = extractUserId(session.user_id);
  const masterUserId = extractUserId(session.master_id?.user_id);
  const endedById = normalizeId(endedBy);
  const endedByCustomer = customerId && normalizeId(customerId) === endedById;
  const endedByMaster = masterUserId && normalizeId(masterUserId) === endedById;

  return {
    customerBody: endedByCustomer
      ? `Hai concluso la sessione ${channelLabel} con ${masterName}.`
      : `${masterName} ha terminato la sessione ${channelLabel}.`,
    masterBody: endedByMaster
      ? `Hai concluso la sessione ${channelLabel} con ${customerName}.`
      : `${customerName} ha terminato la sessione ${channelLabel}.`
  };
};

export const notifyVoiceSessionStarted = async ({ session, startedBy }) => {
  try {
    const customerId = extractUserId(session.user_id);
    const masterUserId = extractUserId(session.master_id?.user_id);
    const { customerBody, masterBody } = buildStartBodies(session, startedBy);
    const actions = [];

    if (customerId) {
      actions.push(createNotification({
        userId: customerId,
        type: 'voice:session:started',
        title: 'Chiamata vocale avviata',
        body: customerBody,
        meta: buildNotificationMeta(session)
      }));
    }

    if (masterUserId) {
      actions.push(createNotification({
        userId: masterUserId,
        type: 'voice:session:started',
        title: 'Chiamata vocale avviata',
        body: masterBody,
        meta: buildNotificationMeta(session)
      }));
    }

    await Promise.all(actions);
  } catch (error) {
    console.error('Failed to notify voice session start', error);
  }
};

export const notifyVoiceSessionEnded = async ({ session, endedBy }) => {
  try {
    const customerId = extractUserId(session.user_id);
    const masterUserId = extractUserId(session.master_id?.user_id);
    const { customerBody, masterBody } = buildEndBodies(session, endedBy);
    const actions = [];

    if (customerId) {
      actions.push(createNotification({
        userId: customerId,
        type: 'voice:session:ended',
        title: 'Chiamata vocale terminata',
        body: customerBody,
        meta: buildNotificationMeta(session)
      }));
    }

    if (masterUserId) {
      actions.push(createNotification({
        userId: masterUserId,
        type: 'voice:session:ended',
        title: 'Chiamata vocale terminata',
        body: masterBody,
        meta: buildNotificationMeta(session)
      }));
    }

    await Promise.all(actions);
  } catch (error) {
    console.error('Failed to notify voice session end', error);
  }
};
