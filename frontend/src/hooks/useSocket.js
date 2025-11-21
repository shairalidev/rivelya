import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import client from '../api/client.js';
import { getToken, subscribeAuthChange } from '../lib/auth.js';

let socketRef = null;

const connectSocket = () => {
  const token = getToken();
  if (!token) {
    console.warn('[voice] No token available for socket connection');
    if (socketRef) {
      socketRef.disconnect();
      socketRef = null;
    }
    return null;
  }
  
  console.info('[voice] Token available, proceeding with connection');

  if (socketRef) {
    if (socketRef.auth?.token !== token) {
      socketRef.disconnect();
      socketRef = null;
    } else {
      if (!socketRef.connected) {
        socketRef.connect();
      }
      return socketRef;
    }
  }

  const baseURL = client.defaults.baseURL;
  const resolveSocketConfig = () => {
    if (typeof window === 'undefined') {
      return { url: baseURL, path: '/socket.io' };
    }

    try {
      const parsed = new URL(baseURL, window.location.origin);
      const origin = `${parsed.protocol}//${parsed.host}`;
      const pathname = parsed.pathname.replace(/\/$/, '');
      const path = `${pathname || ''}/socket.io` || '/socket.io';
      return { url: origin, path: path.startsWith('/') ? path : `/${path}` };
    } catch (error) {
      console.warn('[voice] Failed to parse socket baseURL, falling back to defaults', { baseURL, error: error.message });
      if (baseURL === '/api' || baseURL.endsWith('/api')) {
        return { url: window.location.origin, path: '/api/socket.io' };
      }
      return { url: baseURL, path: '/socket.io' };
    }
  };

  const { url, path } = resolveSocketConfig();

  console.info('[voice] Initializing socket.io connection', { baseURL, url, path });
  socketRef = io(url, {
    auth: { token },
    path,
    transports: ['websocket', 'polling'],
    autoConnect: true,
    timeout: 20000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    forceNew: false
  });

  socketRef.on('connect', () => {
    console.info('[voice] Socket connected', { id: socketRef.id });
    
    // Send heartbeat every 15 seconds to maintain presence
    const heartbeatInterval = setInterval(() => {
      if (socketRef && socketRef.connected) {
        socketRef.emit('presence:heartbeat');
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 15000);
    
    // Store interval reference for cleanup
    socketRef._heartbeatInterval = heartbeatInterval;
  });

  socketRef.on('disconnect', (reason) => {
    console.warn('[voice] Socket disconnected', { reason });
    
    // Clear heartbeat interval
    if (socketRef._heartbeatInterval) {
      clearInterval(socketRef._heartbeatInterval);
      socketRef._heartbeatInterval = null;
    }
  });

  socketRef.io.on('reconnect_attempt', (attempt) => {
    console.info('[voice] Socket attempting reconnect', { attempt });
  });

  socketRef.on('connect_error', (error) => {
    console.error('[voice] Socket connection error', {
      message: error.message,
      description: error.description,
      type: error.type,
      transportError: error?.transportError?.message,
      token: token ? 'present' : 'missing'
    });
    
    // Try to reconnect with polling if websocket fails
    if (error.type === 'TransportError' && socketRef.io.opts.transports[0] === 'websocket') {
      console.info('[voice] Switching to polling transport due to websocket error');
      socketRef.io.opts.transports = ['polling', 'websocket'];
    }
  });

  socketRef.on('error', (error) => {
    console.error('[voice] Socket error', { message: error.message, type: error.type });
  });

  return socketRef;
};

const teardownIfNoToken = () => {
  const token = getToken();
  if (!token && socketRef) {
    socketRef.disconnect();
    socketRef = null;
  }
};

export default function useSocket() {
  const [socket, setSocket] = useState(() => (socketRef && socketRef.connected ? socketRef : null));

  useEffect(() => {
    const setup = () => {
      const instance = connectSocket();
      setSocket(instance && instance.connected ? instance : instance);
    };

    setup();

    const handleAuthChange = () => {
      teardownIfNoToken();
      setup();
    };

    const unsubscribe = subscribeAuthChange(handleAuthChange);

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!socketRef) return undefined;
    const handleConnect = () => setSocket(socketRef);
    const handleDisconnect = () => setSocket(null);
    socketRef.on('connect', handleConnect);
    socketRef.on('disconnect', handleDisconnect);
    return () => {
      socketRef?.off('connect', handleConnect);
      socketRef?.off('disconnect', handleDisconnect);
    };
  }, [socket?.id]);

  return socket;
}
