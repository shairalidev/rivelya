import { serviceClients } from './client.js';

const communicationClient = serviceClients.communication;

export const fetchThreads = async () => {
  const { data } = await communicationClient.get('/chat/threads');
  return data.threads || [];
};

export const fetchThread = async threadId => {
  const { data } = await communicationClient.get(`/chat/threads/${threadId}`);
  return data;
};

export const sendMessage = async (threadId, body) => {
  const { data } = await communicationClient.post(`/chat/threads/${threadId}/messages`, { body });
  return data.message;
};

export const updateThreadNote = async (threadId, note) => {
  const { data } = await communicationClient.put(`/chat/threads/${threadId}/note`, { note });
  return data;
};
