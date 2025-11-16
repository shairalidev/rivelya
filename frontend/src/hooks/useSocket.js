import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import client from '../api/client.js';
import { getToken, subscribeAuthChange } from '../lib/auth.js';

let socketRef = null;

const connectSocket = () => {
  const token = getToken();
  if (!token) {
    if (socketRef) {
      socketRef.disconnect();
      socketRef = null;
    }
    return null;
  }

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

  const apiBaseURL = client.defaults.baseURL;
  const socketURL = apiBaseURL?.replace(/\/api$/, '') || apiBaseURL;
  console.info('[voice] Initializing socket.io connection', { apiBaseURL, socketURL });
  socketRef = io(socketURL, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true
  });

  socketRef.on('connect', () => {
    console.info('[voice] Socket connected', { id: socketRef.id });
  });

  socketRef.on('disconnect', (reason) => {
    console.warn('[voice] Socket disconnected', { reason });
  });

  socketRef.io.on('reconnect_attempt', (attempt) => {
    console.info('[voice] Socket attempting reconnect', { attempt });
  });

  socketRef.on('connect_error', (error) => {
    console.error('[voice] Socket connection error', {
      message: error.message,
      description: error.description,
      type: error.type,
      transportError: error?.transportError?.message
    });
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
