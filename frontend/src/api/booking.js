import client from './client.js';

export const fetchMasterMonthAvailability = (masterId, { year, month }) =>
  client.get(`/catalog/${masterId}/availability`, { params: { year, month } }).then(res => res.data);

export const createBooking = payload => client.post('/bookings', payload).then(res => res.data.booking);

export const fetchMasterRequests = params =>
  client.get('/bookings/master/requests', { params }).then(res => res.data.requests);

export const respondToBooking = (bookingId, payload) =>
  client.post(`/bookings/${bookingId}/respond`, payload).then(res => res.data.booking);

export const fetchAvailabilityMonthForMaster = ({ year, month }) =>
  client.get('/availability/month', { params: { year, month } }).then(res => res.data);

export const addAvailabilityBlock = payload => client.post('/availability/block', payload).then(res => res.data);

export const deleteAvailabilityBlock = (blockId, params) =>
  client.delete(`/availability/block/${blockId}`, { params }).then(res => res.data);
