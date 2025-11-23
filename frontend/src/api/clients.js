import client from './client.js';

export const fetchClientProfile = (id) => client.get(`/profile/clients/${id}`).then(res => res.data.client);

export const fetchClientReservations = (customerId) =>
  client
    .get('/bookings/reservations', { params: { customerId, limit: 50 } })
    .then(res => res.data.reservations);
