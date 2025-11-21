import { useEffect, useState } from 'react';
import useSocket from './useSocket.js';

export default function usePresence() {
  const socket = useSocket();
  const [onlineUsers, setOnlineUsers] = useState(new Map());

  useEffect(() => {
    if (!socket) return undefined;

    const handlePresenceUpdate = (data) => {
      console.log('[presence] Received update:', data);
      setOnlineUsers(prev => {
        const next = new Map(prev);
        next.set(data.userId, {
          isOnline: data.isOnline,
          lastSeen: new Date(data.lastSeen)
        });
        return next;
      });
    };

    socket.on('user:presence:update', handlePresenceUpdate);

    return () => {
      socket.off('user:presence:update', handlePresenceUpdate);
    };
  }, [socket]);

  const isUserOnline = (userId) => {
    const status = onlineUsers.get(String(userId));
    return status?.isOnline || false;
  };

  const getUserLastSeen = (userId) => {
    const status = onlineUsers.get(String(userId));
    return status?.lastSeen || null;
  };

  return {
    isUserOnline,
    getUserLastSeen,
    onlineUsers: Array.from(onlineUsers.entries()).map(([userId, status]) => ({
      userId,
      ...status
    }))
  };
}