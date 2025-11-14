import client from './client.js';

export const fetchThreads = async () => {
  const { data } = await client.get('/chat/threads');
  return data.threads || [];
};

export const fetchThread = async threadId => {
  const { data } = await client.get(`/chat/threads/${threadId}`);
  return data;
};

export const sendMessage = async (threadId, body) => {
  const { data } = await client.post(`/chat/threads/${threadId}/messages`, { body });
  return data.message;
};

export const updateThreadNote = async (threadId, note) => {
  const { data } = await client.put(`/chat/threads/${threadId}/note`, { note });
  return data;
};
