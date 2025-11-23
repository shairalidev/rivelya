import { serviceClients } from './client.js';

const identityClient = serviceClients.identity;
const commerceClient = serviceClients.commerce;

export const fetchClientProfile = (id) => identityClient.get(`/profile/clients/${id}`).then(res => res.data.client);

export const fetchClientReservations = (customerId) =>
  commerceClient
    .get('/bookings/reservations', { params: { customerId, limit: 50 } })
    .then(res => res.data.reservations);
