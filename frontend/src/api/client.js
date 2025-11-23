import axios from 'axios';
import { getToken } from '../lib/auth.js';

const normalizeBaseUrl = url => url?.replace(/\/$/, '');

const inferDefaultBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    const apiUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);
    // For production, ensure we use the full origin for WebSocket connections
    if (apiUrl === '/api' && typeof window !== 'undefined') {
      return `${window.location.origin}/api`;
    }
    return apiUrl;
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }

    if (hostname === '65.0.177.242') {
      return `${protocol}//65.0.177.242:8080`;
    }

    const origin = normalizeBaseUrl(window.location.origin);
    return `${origin}/api`;
  }

  return 'http://localhost:8080';
};

const createHttpClient = baseURL => {
  const instance = axios.create({
    baseURL,
    withCredentials: false
  });

  instance.interceptors.request.use(cfg => {
    const token = getToken();
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  });

  return instance;
};

const defaultBase = inferDefaultBaseUrl();
const client = createHttpClient(defaultBase);

export const serviceClients = {
  identity: createHttpClient(normalizeBaseUrl(import.meta.env.VITE_IDENTITY_SERVICE_URL) || defaultBase),
  content: createHttpClient(normalizeBaseUrl(import.meta.env.VITE_CONTENT_SERVICE_URL) || defaultBase),
  commerce: createHttpClient(normalizeBaseUrl(import.meta.env.VITE_COMMERCE_SERVICE_URL) || defaultBase),
  communication: createHttpClient(normalizeBaseUrl(import.meta.env.VITE_COMMUNICATION_SERVICE_URL) || defaultBase),
  operations: createHttpClient(normalizeBaseUrl(import.meta.env.VITE_OPERATIONS_SERVICE_URL) || defaultBase),
  core: client
};

export default client;
