import client from './client.js';

export const fetchMasterProfile = () => client.get('/master/me').then(res => res.data.master);

export const updateMasterProfile = payload =>
  client.put('/master/me', payload).then(res => res.data.master);
