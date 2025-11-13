import client from './client.js';

export const fetchNotifications = async () => {
  const { data } = await client.get('/notifications');
  return data.notifications || [];
};

export const markNotificationRead = async id => {
  const { data } = await client.post(`/notifications/${id}/read`);
  return data.notification;
};

export const markNotificationsRead = async ids => {
  await client.post('/notifications/read', { ids });
};
