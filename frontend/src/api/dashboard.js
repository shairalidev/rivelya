import { serviceClients } from './client.js';

const commerceClient = serviceClients.commerce;

export const getBookingHistory = async (params = {}) => {
  const { data } = await commerceClient.get('/bookings/customer/history', { params });
  return data;
};

export const requestReschedule = async (bookingId, rescheduleData) => {
  const { data } = await commerceClient.post(`/bookings/${bookingId}/reschedule`, rescheduleData);
  return data;
};

export const respondToReschedule = async (bookingId, payload) => {
  const { data } = await commerceClient.post(`/bookings/${bookingId}/reschedule/respond`, payload);
  return data;
};

export const requestStartNow = async (bookingId) => {
  const { data } = await commerceClient.post(`/bookings/${bookingId}/start-now/request`);
  return data;
};

export const respondStartNow = async (bookingId, action) => {
  const { data } = await commerceClient.post(`/bookings/${bookingId}/start-now/respond`, { action });
  return data;
};

export const getSessionHistory = async (params = {}) => {
  const { data } = await commerceClient.get('/sessions/history', { params });
  return data;
};