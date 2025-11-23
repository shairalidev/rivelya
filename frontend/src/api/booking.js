import { serviceClients } from './client.js';

const contentClient = serviceClients.content;
const commerceClient = serviceClients.commerce;
const identityClient = serviceClients.identity;

export const fetchMasterMonthAvailability = (masterId, { year, month }) =>
  contentClient.get(`/catalog/${masterId}/availability`, { params: { year, month } }).then(res => res.data);

export const createBooking = payload => commerceClient.post('/bookings', payload).then(res => res.data.booking);

export const fetchMasterRequests = params =>
  commerceClient.get('/bookings/master/requests', { params }).then(res => res.data.requests);

export const respondToBooking = (bookingId, payload) =>
  commerceClient.post(`/bookings/${bookingId}/respond`, payload).then(res => res.data.booking);

export const fetchAvailabilityMonthForMaster = ({ year, month }) =>
  identityClient.get('/availability/month', { params: { year, month } }).then(res => res.data);

export const addAvailabilityBlock = payload => identityClient.post('/availability/block', payload).then(res => res.data);

export const deleteAvailabilityBlock = (blockId, params) =>
  identityClient.delete(`/availability/block/${blockId}`, { params }).then(res => res.data);
