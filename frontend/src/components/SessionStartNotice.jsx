import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useSocket from '../hooks/useSocket.js';
import { getToken } from '../lib/auth.js';

const resolveSessionUrl = payload => {
  if (!payload) return null;
  if (payload.sessionUrl) return payload.sessionUrl;
  if (payload.url) return payload.url;

  const channel = payload.channel || payload.sessionType || payload.type;
  const sessionId = payload.sessionId || payload.reservationId || payload.bookingId || payload.id;

  if (!sessionId) return null;

  if (channel === 'voice' || channel === 'chat_voice') {
    return `/voice/${sessionId}`;
  }

  if (channel === 'chat') {
    return `/chat/${sessionId}`;
  }

  return null;
};

export default function SessionStartNotice() {
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState(null);
  const token = typeof window !== 'undefined' ? getToken() : null;

  // Clear any stale notice after navigation
  useEffect(() => {
    setNotice(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!socket || !token) return undefined;

    const openNotice = (payload, source) => {
      const url = resolveSessionUrl(payload);
      const sessionId = payload?.sessionId || payload?.reservationId || payload?.bookingId || payload?.id;
      const reservationLabel = payload?.reservationId ? ` ${payload.reservationId}` : '';

      if (url && typeof window !== 'undefined') {
        try {
          const path = url.startsWith('http') ? new URL(url, window.location.origin).pathname : url;
          if (path === location.pathname) {
            return;
          }
        } catch {
          // Ignore URL parse errors and still show the notice
        }
      }

      setNotice({
        title: `Sessione${reservationLabel} attiva`,
        body: payload?.autoStarted
          ? 'La sessione è partita automaticamente. Raggiungi subito la stanza.'
          : 'Hai una sessione in corso. Entra per non perdere tempo.',
        url,
        sessionId,
        channel: payload?.channel || payload?.sessionType || payload?.type || source
      });
    };

    const handleBookingSessionStarted = payload => openNotice(payload, 'booking');
    const handleVoiceSessionStarted = payload => openNotice({ ...payload, channel: 'voice' }, 'voice');

    socket.on('booking:session_started', handleBookingSessionStarted);
    socket.on('voice:session:started', handleVoiceSessionStarted);

    return () => {
      socket.off('booking:session_started', handleBookingSessionStarted);
      socket.off('voice:session:started', handleVoiceSessionStarted);
    };
  }, [socket, token, location.pathname]);

  if (!token || !notice) return null;

  const openSession = () => {
    if (notice.url) {
      navigate(notice.url);
    } else if (notice.channel === 'voice' && notice.sessionId) {
      navigate(`/voice/${notice.sessionId}`);
    } else if (notice.sessionId) {
      navigate(`/chat/${notice.sessionId}`);
    }
    setNotice(null);
  };

  return (
    <div className="session-start-notice" role="dialog" aria-live="polite">
      <div className="session-start-backdrop" aria-hidden="true" />
      <div className="session-start-card">
        <div className="session-start-pulse" aria-hidden="true" />
        <p className="session-start-kicker">Sessione attiva</p>
        <h3>{notice.title || 'Hai una sessione in corso'}</h3>
        <p className="session-start-body">{notice.body}</p>
        <div className="session-start-actions">
          <button type="button" className="btn ghost" onClick={() => setNotice(null)}>
            Chiudi
          </button>
          <button type="button" className="btn primary" onClick={openSession}>
            Apri sessione
          </button>
        </div>
      </div>
    </div>
  );
}
