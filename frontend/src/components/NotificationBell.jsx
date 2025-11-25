import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import useSocket from '../hooks/useSocket.js';
import { fetchNotifications, markNotificationRead, markNotificationsRead } from '../api/notifications.js';
import { getToken, subscribeAuthChange } from '../lib/auth.js';

dayjs.extend(relativeTime);

const formatWhen = date => {
  if (!date) return '';
  return dayjs(date).fromNow();
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const queryClient = useQueryClient();
  const token = typeof window !== 'undefined' ? getToken() : null;

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    enabled: Boolean(token),
    refetchInterval: 60_000
  });

  const markSingle = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAll = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const socket = useSocket();

  useEffect(() => {
    if (!socket) return undefined;
    const handleNotification = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    socket.on('notification:new', handleNotification);
    return () => {
      socket.off('notification:new', handleNotification);
    };
  }, [socket, queryClient]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointer = event => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKey = event => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('touchstart', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('touchstart', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    const handleAuth = () => {
      queryClient.removeQueries({ queryKey: ['notifications'] });
    };
    const unsubscribe = subscribeAuthChange(handleAuth);
    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  const unreadCount = useMemo(
    () => (notificationsQuery.data || []).filter(item => !item.readAt).length,
    [notificationsQuery.data]
  );

  if (!token) return null;

  const toggle = () => setOpen(prev => !prev);
  const close = () => setOpen(false);
  const notifications = notificationsQuery.data || [];

  const handleMark = id => {
    markSingle.mutate(id);
  };

  const handleMarkAll = () => {
    const unreadIds = notifications.filter(item => !item.readAt).map(item => item.id);
    if (unreadIds.length === 0) return;
    markAll.mutate(unreadIds);
  };

  return (
    <div className={`notification-bell${open ? ' open' : ''}`} ref={panelRef}>
      <button type="button" className="notification-trigger" onClick={toggle} aria-haspopup="true" aria-expanded={open}>
        <span className="icon" aria-hidden="true">🔔</span>
        {unreadCount > 0 && <span className="badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {open && (
        <>
          <div className="notification-backdrop" onClick={close} role="presentation" />
          <div className="notification-panel" role="menu">
            <div className="notification-header">
            <h3>Notifiche</h3>
            <div className="notification-actions">
              <button
              type="button"
              className="mark-all"
              onClick={handleMarkAll}
              disabled={markAll.isPending || unreadCount === 0}
            >
              Segna tutte come lette
            </button>
              <button
                type="button"
                className="notification-close"
                aria-label="Chiudi pannello notifiche"
                onClick={close}
              >
                ×
              </button>
            </div>
            </div>
          <div className="notification-list">
            {notifications.length === 0 && (
              <p className="notification-empty">Nessuna notifica al momento.</p>
            )}
            {notifications.map(item => (
              <div key={item.id} className={`notification-item${item.readAt ? '' : ' unread'}`}>
                <div className="notification-copy">
                  <p className="notification-title">{item.title}</p>
                  <p className="notification-body">{item.body}</p>
                  <p className="notification-meta">{formatWhen(item.createdAt)}</p>
                </div>
                {!item.readAt && (
                  <button
                    type="button"
                    className="notification-read"
                    onClick={() => handleMark(item.id)}
                    disabled={markSingle.isPending}
                  >
                    Letta
                  </button>
                )}
              </div>
            ))}
          </div>
          </div>
        </>
      )}
    </div>
  );
}
