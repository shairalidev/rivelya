import axios from 'axios';

const inferDefaultBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;

    if (host === 'rivelya.duckdns.org') {
      return 'http://65.0.177.242:8080';
    }

    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8080';
    }
  }

  return 'http://localhost:8080';
};

const client = axios.create({
  baseURL: inferDefaultBaseUrl(),
  withCredentials: false
});

client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export default client;
