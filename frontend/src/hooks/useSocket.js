import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import client from '../api/client.js';

let socketRef = null;

const connectSocket = () => {
  const token = localStorage.getItem('token');
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

  socketRef = io(client.defaults.baseURL, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true
  });

  return socketRef;
};

const teardownIfNoToken = () => {
  const token = localStorage.getItem('token');
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

    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('rivelya-auth-change', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('rivelya-auth-change', handleAuthChange);
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
