const TOKEN_KEY = 'rivelya:token';
const USER_KEY = 'rivelya:user';
const CHANNEL_NAME = 'rivelya-auth-channel';

let storageRef;
let memoryStore = { token: null, user: null };
let broadcastRef;

const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

const isBrowser = () => typeof window !== 'undefined';

const resolveStorage = () => {
  if (!isBrowser()) return null;
  if (storageRef !== undefined) return storageRef;
  try {
    const { sessionStorage } = window;
    if (!sessionStorage) {
      storageRef = null;
      return storageRef;
    }
    const testKey = '__rivelya_test__';
    sessionStorage.setItem(testKey, '1');
    sessionStorage.removeItem(testKey);
    storageRef = sessionStorage;
  } catch (err) {
    if (isDev) {
      console.warn('Session storage unavailable, falling back to in-memory auth store.', err);
    }
    storageRef = null;
  }
  return storageRef;
};

const getBroadcastChannel = () => {
  if (!isBrowser() || typeof BroadcastChannel === 'undefined') return null;
  if (!broadcastRef) {
    broadcastRef = new BroadcastChannel(CHANNEL_NAME);
  }
  return broadcastRef;
};

const readRaw = key => {
  const storage = resolveStorage();
  if (!storage) {
    return memoryStore[key === TOKEN_KEY ? 'token' : 'user'];
  }
  return storage.getItem(key);
};

const writeRaw = (key, value) => {
  const storage = resolveStorage();
  if (!storage) {
    memoryStore = {
      ...memoryStore,
      [key === TOKEN_KEY ? 'token' : 'user']: value ?? null
    };
    return;
  }
  if (value === null || typeof value === 'undefined') {
    storage.removeItem(key);
  } else {
    storage.setItem(key, value);
  }
};

export const getToken = () => {
  const raw = readRaw(TOKEN_KEY);
  return raw ?? null;
};

export const setToken = token => {
  writeRaw(TOKEN_KEY, token ?? null);
};

export const getUser = () => {
  const raw = readRaw(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    if (isDev) {
      console.warn('Failed to parse stored user.', err);
    }
    return null;
  }
};

export const setUser = user => {
  if (!user) {
    writeRaw(USER_KEY, null);
    return;
  }
  writeRaw(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  writeRaw(TOKEN_KEY, null);
  writeRaw(USER_KEY, null);
};

export const notifyAuthChange = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event('rivelya-auth-change'));
  const channel = getBroadcastChannel();
  channel?.postMessage({ type: 'auth-change', at: Date.now() });
  try {
    window.localStorage.setItem('rivelya:auth:ping', JSON.stringify({ at: Date.now() }));
    window.localStorage.removeItem('rivelya:auth:ping');
  } catch (err) {
    if (isDev) {
      console.warn('Unable to fan-out auth change via localStorage.', err);
    }
  }
};

export const subscribeAuthChange = handler => {
  if (!isBrowser()) return () => {};
  const channel = getBroadcastChannel();
  const onBroadcast = event => {
    if (event?.data?.type === 'auth-change') handler();
  };
  const onWindowEvent = () => handler();
  const onStorage = event => {
    if (event.key === 'rivelya:auth:ping') handler();
  };
  window.addEventListener('rivelya-auth-change', onWindowEvent);
  window.addEventListener('storage', onStorage);
  channel?.addEventListener('message', onBroadcast);
  return () => {
    window.removeEventListener('rivelya-auth-change', onWindowEvent);
    window.removeEventListener('storage', onStorage);
    channel?.removeEventListener('message', onBroadcast);
  };
};
