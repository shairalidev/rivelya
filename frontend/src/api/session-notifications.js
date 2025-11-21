import client from './client.js';

export const subscribeToSessionEnd = async (masterId) => {
  const response = await client.post('/session-notifications/subscribe', {
    master_id: masterId
  });
  return response.data;
};

export const unsubscribeFromSessionEnd = async (masterId) => {
  const response = await client.post('/session-notifications/unsubscribe', {
    master_id: masterId
  });
  return response.data;
};

export const getSubscriptionStatus = async (masterId) => {
  const response = await client.get(`/session-notifications/status/${masterId}`);
  return response.data;
};