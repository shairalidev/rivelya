import { serviceClients } from './client.js';

const identityClient = serviceClients.identity;

export const fetchProfile = () => identityClient.get('/profile/me').then(res => res.data.user);

export const updateProfile = payload => identityClient.put('/profile/me', payload).then(res => res.data.user);

export const uploadAvatar = file => {
  const formData = new FormData();
  formData.append('avatar', file);
  return identityClient.post('/profile/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data.user);
};

export const removeAvatar = () => identityClient.delete('/profile/me/avatar').then(res => res.data.user);
