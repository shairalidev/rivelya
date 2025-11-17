import client from './client.js';

export const getBookingHistory = async (params = {}) => {
  const { data } = await client.get('/bookings/customer/history', { params });
  return data;
};

export const requestReschedule = async (bookingId, rescheduleData) => {
  const { data } = await client.post(`/bookings/${bookingId}/reschedule`, rescheduleData);
  return data;
};

export const respondToReschedule = async (bookingId, action) => {
  const { data } = await client.post(`/bookings/${bookingId}/reschedule/respond`, { action });
  return data;
};

export const getSessionHistory = async (params = {}) => {
  const { data } = await client.get('/sessions/history', { params });
  return data;
};