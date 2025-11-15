import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useCountdown from '../hooks/useCountdown.js';
import client from '../api/client.js';

const formatDuration = seconds => {
  if (seconds == null) return '--:--';
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

export default function Voice() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [callStatus, setCallStatus] = useState('connecting');
  const remainingSeconds = useCountdown(session?.expiresAt);

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }

    const loadSession = async () => {
      try {
        const res = await client.get(`/session/${sessionId}`);
        setSession(res.data);
        setCallStatus(res.data.status || 'connecting');
      } catch (error) {
        console.error('Session load error:', error);
        toast.error('Sessione non trovata');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId, navigate]);

  const endCall = async () => {
    try {
      await client.post(`/session/${sessionId}/end`);
      toast.success('Chiamata terminata');
      navigate('/');
    } catch (error) {
      toast.error('Errore durante la chiusura della chiamata');
    }
  };

  if (loading) {
    return (
      <section className="container voice-call">
        <div className="voice-call-card">
          <p>Caricamento sessione...</p>
        </div>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="container voice-call">
        <div className="voice-call-card">
          <p>Sessione non trovata</p>
        </div>
      </section>
    );
  }

  const masterName = session?.master?.name || 'Master Rivelya';
  const masterAvatar = session?.master?.avatarUrl || '';
  const isActive = callStatus === 'active';
  const isEnded = callStatus === 'ended' || (remainingSeconds !== null && remainingSeconds <= 0);

  return (
    <section className="container voice-call">
      <div className="voice-call-card">
        <div className="voice-call-header">
          <div className="voice-call-avatar">
            {masterAvatar ? (
              <img src={masterAvatar} alt={masterName} />
            ) : (
              <div className="avatar-placeholder">
                {masterName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="voice-call-info">
            <h2>{masterName}</h2>
            <p className="voice-call-status">
              {isEnded ? 'Chiamata terminata' : isActive ? 'In chiamata' : 'Connessione in corso...'}
            </p>
          </div>
        </div>

        <div className="voice-call-timer">
          <div className="timer-display">
            <span className="timer-label">Tempo rimanente</span>
            <span className={`timer-value ${isEnded ? 'expired' : ''}`}>
              {formatDuration(remainingSeconds)}
            </span>
          </div>
        </div>

        <div className="voice-call-controls">
          {!isEnded && (
            <button 
              type="button" 
              className="btn danger voice-end-btn"
              onClick={endCall}
            >
              Termina chiamata
            </button>
          )}
          {isEnded && (
            <button 
              type="button" 
              className="btn primary"
              onClick={() => navigate('/')}
            >
              Torna alla home
            </button>
          )}
        </div>

        <div className="voice-call-info-panel">
          <h3>Informazioni chiamata</h3>
          <div className="info-grid">
            <div>
              <span className="info-label">Tipo sessione</span>
              <span>Solo voce</span>
            </div>
            <div>
              <span className="info-label">Tariffa</span>
              <span>{session.rate ? `${(session.rate / 100).toFixed(2)} €/min` : '—'}</span>
            </div>
            <div>
              <span className="info-label">Durata massima</span>
              <span>{session.maxDuration ? `${session.maxDuration} min` : 'Illimitata'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}