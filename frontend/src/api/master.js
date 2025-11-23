import { serviceClients } from './client.js';

const identityClient = serviceClients.identity;

export const fetchMasterProfile = () => identityClient.get('/master/me').then(res => res.data.master);

export const updateMasterProfile = payload =>
  identityClient.put('/master/me', payload).then(res => res.data.master);
