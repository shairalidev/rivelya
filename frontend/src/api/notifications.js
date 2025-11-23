import { serviceClients } from './client.js';

const communicationClient = serviceClients.communication;

export const fetchNotifications = async () => {
  const { data } = await communicationClient.get('/notifications');
  return data.notifications || [];
};

export const markNotificationRead = async id => {
  const { data } = await communicationClient.post(`/notifications/${id}/read`);
  return data.notification;
};

export const markNotificationsRead = async ids => {
  await communicationClient.post('/notifications/read', { ids });
};
