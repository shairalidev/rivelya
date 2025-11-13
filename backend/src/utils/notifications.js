import { Notification } from '../models/notification.model.js';
import { emitToUser } from '../lib/socket.js';

export const createNotification = async ({ userId, type, title, body, meta = {} }) => {
  if (!userId) return null;
  const notification = await Notification.create({
    user_id: userId,
    type,
    title,
    body,
    meta
  });

  emitToUser(userId, 'notification:new', {
    id: notification._id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    meta: notification.meta,
    createdAt: notification.createdAt,
    readAt: notification.read_at
  });

  return notification;
};
