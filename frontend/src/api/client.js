import axios from 'axios';
import { getToken } from '../lib/auth.js';

const inferDefaultBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }

    if (hostname === '65.0.177.242') {
      return `${protocol}//65.0.177.242:8080`;
    }

    const origin = window.location.origin.replace(/\/$/, '');
    return `${origin}/api`;
  }

  return 'http://localhost:8080';
};

const client = axios.create({
  baseURL: inferDefaultBaseUrl(),
  withCredentials: false
});

client.interceptors.request.use(cfg => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export default client;
