import client from './client.js';

export const fetchProfile = () => client.get('/profile/me').then(res => res.data.user);

export const updateProfile = payload => client.put('/profile/me', payload).then(res => res.data.user);

export const uploadAvatar = file => {
  const formData = new FormData();
  formData.append('avatar', file);
  return client.post('/profile/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data.user);
};

export const removeAvatar = () => client.delete('/profile/me/avatar').then(res => res.data.user);
