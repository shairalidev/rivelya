import { serviceClients } from './client.js';

const commerceClient = serviceClients.commerce;

export const subscribeToSessionEnd = async (masterId) => {
  const response = await commerceClient.post('/session-notifications/subscribe', {
    master_id: masterId
  });
  return response.data;
};

export const unsubscribeFromSessionEnd = async (masterId) => {
  const response = await commerceClient.post('/session-notifications/unsubscribe', {
    master_id: masterId
  });
  return response.data;
};

export const getSubscriptionStatus = async (masterId) => {
  const response = await commerceClient.get(`/session-notifications/status/${masterId}`);
  return response.data;
};