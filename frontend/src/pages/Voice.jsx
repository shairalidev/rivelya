import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/it.js';
import useSocket from '../hooks/useSocket.js';
import useCountdown from '../hooks/useCountdown.js';
import { getToken, subscribeAuthChange } from '../lib/auth.js';
import client from '../api/client.js';
import ConfirmModal from '../components/ConfirmModal.jsx';

const formatDuration = seconds => {
  if (seconds == null) return '--:--';
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const buildPreview = session => {
  if (!session) return 'Nessuna sessione';
  if (session.status === 'ended') {
    const duration = session.duration ? `${Math.floor(session.duration / 60)}:${String(session.duration % 60).padStart(2, '0')}` : '—';
    return `Durata: ${duration} • ${session.cost ? `${(session.cost / 100).toFixed(2)}€` : 'Gratuita'}`;
  }
  return session.status === 'active' ? 'In corso...' : 'In attesa';
};

const resolveName = session => {
  if (!session) return '';
  return session.master?.name || session.customer?.name || 'Sessione vocale';
};

const fetchVoiceSessions = async () => {
  const res = await client.get('/voice/sessions');
  return res.data;
};

const fetchVoiceSession = async (sessionId) => {
  const res = await client.get(`/voice/session/${sessionId}`);
  return res.data;
};

const updateSessionNote = async (sessionId, note) => {
  const res = await client.put(`/voice/session/${sessionId}/note`, { note });
  return res.data;
};

const MicIcon = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" x2="12" y1="19" y2="23"/>
    <line x1="8" x2="16" y1="23" y2="23"/>
  </svg>
);

const MicOffIcon = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="2" x2="22" y1="2" y2="22"/>
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/>
    <path d="M5 10v2a7 7 0 0 0 12 5"/>
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
    <line x1="12" x2="12" y1="19" y2="23"/>
    <line x1="8" x2="16" y1="23" y2="23"/>
  </svg>
);

const PhoneIcon = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

export default function Voice() {
  dayjs.locale('it');
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setTokenState] = useState(() => getToken());
  const queryClient = useQueryClient();
  const socket = useSocket();
  const [noteDraft, setNoteDraft] = useState('');
  const [noteBaseline, setNoteBaseline] = useState('');
  const [noteUpdatedAt, setNoteUpdatedAt] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [micPermission, setMicPermission] = useState(null);
  const [audioStream, setAudioStream] = useState(null);

  useEffect(() => {
    const sync = () => {
      setTokenState(getToken());
    };
    const unsubscribe = subscribeAuthChange(sync);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!token) {
      toast.error('Effettua l\'accesso per usare le chiamate vocali.');
      navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
    }
  }, [token, navigate, location.pathname, location.search]);

  const sessionsQuery = useQuery({
    queryKey: ['voice', 'sessions'],
    queryFn: fetchVoiceSessions,
    enabled: Boolean(token)
  });

  const sessionQuery = useQuery({
    queryKey: ['voice', 'session', sessionId],
    queryFn: () => fetchVoiceSession(sessionId),
    enabled: Boolean(token && sessionId)
  });

  const stopAudioStream = () => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
      setIsMuted(false);
    }
  };

  useEffect(() => {
    if (!sessionId) {
      setNoteDraft('');
      setNoteBaseline('');
      setNoteUpdatedAt(null);
      setIsConnected(false);
      stopAudioStream();
    }
  }, [sessionId]);

  const sessions = useMemo(() => sessionsQuery.data || [], [sessionsQuery.data]);
  
  const { activeSessions, completedSessions } = useMemo(() => {
    const active = sessions.filter(s => s.status === 'active' || s.status === 'created');
    const completed = sessions.filter(s => s.status === 'ended');
    return { activeSessions: active, completedSessions: completed };
  }, [sessions]);

  const activeSession = sessionQuery.data?.session;
  const remainingSeconds = useCountdown(activeSession?.expiresAt);
  const canCall = sessionQuery.data?.canCall && (remainingSeconds == null || remainingSeconds > 0);
  const isNoteDirty = noteDraft !== noteBaseline;
  const isSessionActive = activeSession?.status === 'active';
  const isSessionEnded = activeSession?.status === 'ended';
  const shouldShowEmpty = !sessionId && sessions.length === 0 && !sessionsQuery.isLoading;

  useEffect(() => {
    if (!activeSession) return;

    if (activeSession.status === 'active') {
      setIsConnected(true);
    } else {
      setIsConnected(false);
      stopAudioStream();
    }
  }, [activeSession?.status]);


  useEffect(() => {
    if (!sessionId) return;
    const noteValue = sessionQuery.data?.session?.note ?? '';
    setNoteDraft(noteValue);
    setNoteBaseline(noteValue);
    setNoteUpdatedAt(sessionQuery.data?.noteUpdatedAt || null);
  }, [sessionId, sessionQuery.data?.session?.note, sessionQuery.data?.noteUpdatedAt]);

  useEffect(() => {
    if (!socket) return undefined;
    
    const handleSessionUpdate = payload => {
      queryClient.invalidateQueries({ queryKey: ['voice', 'sessions'] });
      if (payload.sessionId && payload.sessionId === sessionId) {
        queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
      }
    };
    
    const handleSessionStarted = payload => {
      if (payload.sessionId === sessionId) {
        setIsConnected(true);
        toast.success('Chiamata avviata dal partner');
        queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
      }
      queryClient.invalidateQueries({ queryKey: ['voice', 'sessions'] });
    };
    
    const handleSessionEnded = payload => {
      if (payload.sessionId === sessionId) {
        setIsConnected(false);
        stopAudioStream();
        toast.info('Chiamata terminata dal partner');
        queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
      }
      queryClient.invalidateQueries({ queryKey: ['voice', 'sessions'] });
    };
    
    const handleSessionExpired = payload => {
      if (payload.sessionId === sessionId) {
        setIsConnected(false);
        stopAudioStream();
        toast.warning('⏰ Sessione scaduta automaticamente');
        queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
      }
      queryClient.invalidateQueries({ queryKey: ['voice', 'sessions'] });
    };
    
    socket.on('voice:session:updated', handleSessionUpdate);
    socket.on('voice:session:started', handleSessionStarted);
    socket.on('voice:session:ended', handleSessionEnded);
    socket.on('voice:session:expired', handleSessionExpired);
    
    return () => {
      socket.off('voice:session:updated', handleSessionUpdate);
      socket.off('voice:session:started', handleSessionStarted);
      socket.off('voice:session:ended', handleSessionEnded);
      socket.off('voice:session:expired', handleSessionExpired);
    };
  }, [socket, queryClient, sessionId]);

  const noteMutation = useMutation({
    mutationFn: note => updateSessionNote(sessionId, note),
    onSuccess: data => {
      const noteValue = data?.note ?? '';
      const updatedAt = data?.noteUpdatedAt || null;
      setNoteDraft(noteValue);
      setNoteBaseline(noteValue);
      setNoteUpdatedAt(updatedAt);
      if (sessionId) {
        queryClient.setQueryData(['voice', 'session', sessionId], previous =>
          previous ? { 
            ...previous, 
            session: { ...previous.session, note: noteValue },
            noteUpdatedAt: updatedAt 
          } : previous
        );
      }
      toast.success('Note salvate.');
    },
    onError: error => {
      const msg = error?.response?.data?.message || 'Impossibile salvare le note.';
      toast.error(msg);
    }
  });

  const handleNoteSave = () => {
    if (!sessionId) return;
    noteMutation.mutate(noteDraft);
  };

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setMicPermission('granted');
      return true;
    } catch (error) {
      setMicPermission('denied');
      toast.error('Accesso al microfono negato. Abilita il microfono nelle impostazioni del browser.');
      return false;
    }
  };

  const toggleMute = () => {
    if (!audioStream) return;
    
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    // Control actual microphone
    audioStream.getAudioTracks().forEach(track => {
      track.enabled = !newMutedState;
    });
    
    if (newMutedState) {
      toast.info('🔇 Microfono disattivato');
    } else {
      toast.success('🎤 Microfono attivato');
    }
    
    if (socket && sessionId) {
      socket.emit('voice:mute:toggle', { sessionId, isMuted: newMutedState });
    }
  };

  const startCall = async () => {
    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      setShowStartModal(false);
      return;
    }
    
    try {
      const response = await client.post(`/voice/session/${sessionId}/start`);
      setIsConnected(true);
      setShowStartModal(false);
      toast.success('Chiamata avviata');
      queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
    } catch (error) {
      const message = error?.response?.data?.message || 'Impossibile avviare la chiamata';
      toast.error(message);
      setShowStartModal(false);
      stopAudioStream();
    }
  };

  const endCall = async () => {
    try {
      const response = await client.post(`/voice/session/${sessionId}/end`);
      setIsConnected(false);
      setShowEndModal(false);
      stopAudioStream();
      toast.success('Chiamata terminata');
      queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['voice', 'sessions'] });
    } catch (error) {
      const message = error?.response?.data?.message || 'Errore durante la chiusura della chiamata';
      toast.error(message);
      setShowEndModal(false);
    }
  };

  const viewerRole = sessionQuery.data?.viewerRole;
  const masterName = activeSession?.master?.name || 'Master Rivelya';
  const masterAvatar = activeSession?.master?.avatarUrl || '';
  const masterInitial = masterName.charAt(0).toUpperCase();
  const customerName = activeSession?.customer?.name || 'Cliente Rivelya';
  const customerAvatar = activeSession?.customer?.avatarUrl || '';
  const customerInitial = customerName.charAt(0).toUpperCase();

  return (
    <section className="container voice-page">
      <div className="voice-layout">
        <aside className="voice-sidebar">
          <div className="voice-sidebar-header">
            <h1>Chiamate Vocali</h1>
            <p>Gestisci le tue sessioni vocali e rivedi la cronologia delle conversazioni.</p>
            {sessions.length > 0 && (
              <div className="voice-stats">
                <div className="voice-stat">
                  <span className="voice-stat-value">{activeSessions.length}</span>
                  <span className="voice-stat-label">Attive</span>
                </div>
                <div className="voice-stat">
                  <span className="voice-stat-value">{completedSessions.length}</span>
                  <span className="voice-stat-label">Completate</span>
                </div>
              </div>
            )}
          </div>
          <div className="voice-session-list">
            {sessionsQuery.isLoading && <p className="voice-placeholder">Caricamento…</p>}
            {!sessionsQuery.isLoading && sessions.length === 0 && (
              <p className="voice-placeholder">Non hai ancora sessioni vocali.</p>
            )}
            
            {activeSessions.length > 0 && (
              <>
                <div className="voice-section-header">
                  <h3>Sessioni Attive</h3>
                </div>
                {activeSessions.map(session => {
                  const isActive = session.id === sessionId;
                  const hasTimer = Boolean(session.expiresAt);
                  const isExpired = session.status === 'expired' || (hasTimer && session.remainingSeconds === 0);
                  const countdown =
                    hasTimer && !isExpired && typeof session.remainingSeconds === 'number'
                      ? formatDuration(session.remainingSeconds)
                      : null;

                  return (
                    <button
                      key={session.id}
                      type="button"
                      className={`voice-session${isActive ? ' active' : ''} status-${session.status}`}
                      onClick={() => navigate(`/voice/${session.id}`)}
                    >
                      <div className="voice-session-header">
                        <div className="voice-session-main">
                          <span className="voice-session-name">{resolveName(session)}</span>
                          <span className={`voice-session-channel voice ${session.status}`}>
                            <span className="icon-wrapper" aria-hidden="true">
                              <PhoneIcon />
                            </span>
                            {session.status === 'ended' ? 'Terminata' : session.status === 'active' ? 'In corso' : 'Voce'}
                          </span>
                        </div>
                      </div>
                      <p className="voice-session-preview">{buildPreview(session)}</p>
                      <div className="voice-session-footer">
                        <span className="voice-session-slot">
                          {session.startTime ? 
                            dayjs(session.startTime).format('DD MMM YYYY · HH:mm') :
                            dayjs(session.createdAt).format('DD MMM YYYY · HH:mm')
                          }
                        </span>
                        {hasTimer ? (
                          countdown ? (
                            <span className="voice-session-timer">{countdown}</span>
                          ) : (
                            <span className="voice-session-timer expired">Scaduta</span>
                          )
                        ) : session.status === 'ended' ? (
                          <span className="voice-session-timer ended">
                            {session.duration ? `${Math.floor(session.duration / 60)}m` : '—'}
                          </span>
                        ) : (
                          <span className="voice-session-timer idle">Senza limite</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </>
            )}
            
            {completedSessions.length > 0 && (
              <>
                <div className="voice-section-header">
                  <h3>Cronologia Chiamate</h3>
                </div>
                {completedSessions.slice(0, 10).map(session => {
                  const isActive = session.id === sessionId;
                  const hasTimer = Boolean(session.expiresAt);
                  const isExpired = session.status === 'expired' || (hasTimer && session.remainingSeconds === 0);
                  const countdown =
                    hasTimer && !isExpired && typeof session.remainingSeconds === 'number'
                      ? formatDuration(session.remainingSeconds)
                      : null;

                  return (
                    <button
                      key={session.id}
                      type="button"
                      className={`voice-session${isActive ? ' active' : ''} status-${session.status}`}
                      onClick={() => navigate(`/voice/${session.id}`)}
                    >
                      <div className="voice-session-header">
                        <div className="voice-session-main">
                          <span className="voice-session-name">{resolveName(session)}</span>
                          <span className={`voice-session-channel voice ${session.status}`}>
                            <span className="icon-wrapper" aria-hidden="true">
                              <PhoneIcon />
                            </span>
                            {session.status === 'ended' ? 'Terminata' : session.status === 'active' ? 'In corso' : 'Voce'}
                          </span>
                        </div>
                      </div>
                      <p className="voice-session-preview">{buildPreview(session)}</p>
                      <div className="voice-session-footer">
                        <span className="voice-session-slot">
                          {session.startTime ? 
                            dayjs(session.startTime).format('DD MMM YYYY · HH:mm') :
                            dayjs(session.createdAt).format('DD MMM YYYY · HH:mm')
                          }
                        </span>
                        {hasTimer ? (
                          countdown ? (
                            <span className="voice-session-timer">{countdown}</span>
                          ) : (
                            <span className="voice-session-timer expired">Scaduta</span>
                          )
                        ) : session.status === 'ended' ? (
                          <span className="voice-session-timer ended">
                            {session.duration ? `${Math.floor(session.duration / 60)}m` : '—'}
                          </span>
                        ) : (
                          <span className="voice-session-timer idle">Senza limite</span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {completedSessions.length > 10 && (
                  <div className="voice-more-sessions">
                    <p>E altre {completedSessions.length - 10} sessioni completate...</p>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
        <section className="voice-pane">
          {shouldShowEmpty && (
            <div className="voice-empty-card">
              <h2>Nessuna chiamata vocale</h2>
              <p>Non hai ancora effettuato chiamate vocali. Visita il profilo di un master per iniziare una sessione vocale e iniziare a consultarti in tempo reale.</p>
              <button 
                type="button" 
                className="btn primary"
                onClick={() => navigate('/catalog')}
              >
                Esplora Master
              </button>
            </div>
          )}
          {!sessionId && sessions.length > 0 && (
            <div className="voice-empty-card">
              <h2>Seleziona una sessione vocale</h2>
              <p>Scegli una chiamata dalla lista per vedere i dettagli e gestire le tue conversazioni.</p>
            </div>
          )}
          {sessionId && sessionQuery.isLoading && (
            <div className="voice-empty-card">
              <p>Recupero sessione…</p>
            </div>
          )}
          {sessionId && sessionQuery.isError && (
            <div className="voice-empty-card">
              <p>Non è stato possibile caricare la sessione selezionata.</p>
            </div>
          )}
          {sessionId && activeSession && (
            <div className="voice-room">
              <div className="voice-room-main">
                <header className="voice-room-header">
                  <div className="voice-room-heading">
                    <h2>{resolveName(activeSession)}</h2>
                    <div className="voice-room-meta">
                      <div className="voice-session-pill voice">
                        <span className="icon-wrapper" aria-hidden="true">
                          <PhoneIcon />
                        </span>
                        <div className="voice-session-copy">
                          <span className="channel-label">Sessione vocale</span>
                          <span className="channel-rate">
                            {activeSession.rate ? `${(activeSession.rate / 100).toFixed(2)} €/min` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="voice-room-timer">
                    <span>Tempo residuo</span>
                    <strong className={canCall && !isSessionEnded ? '' : 'expired'}>
                      {isSessionEnded ? '00:00' : formatDuration(remainingSeconds)}
                    </strong>
                  </div>
                </header>
                
                <div className="voice-call-area">
                  <div className="voice-participants">
                    <div className="voice-participant">
                      <div className="voice-avatar">
                        {masterAvatar ? (
                          <img src={masterAvatar} alt={masterName} />
                        ) : (
                          <span>{masterInitial}</span>
                        )}
                      </div>
                      <span className="voice-participant-name">{masterName}</span>
                      <span className="voice-participant-role">Master</span>
                    </div>
                    
                    <div className="voice-participant">
                      <div className="voice-avatar">
                        {customerAvatar ? (
                          <img src={customerAvatar} alt={customerName} />
                        ) : (
                          <span>{customerInitial}</span>
                        )}
                      </div>
                      <span className="voice-participant-name">{customerName}</span>
                      <span className="voice-participant-role">Cliente</span>
                    </div>
                  </div>

                  <div className="voice-controls">
                    {isSessionActive && audioStream && (
                      <button
                        type="button"
                        className={`voice-control-btn ${isMuted ? 'muted' : ''}`}
                        onClick={toggleMute}
                        title={isMuted ? 'Attiva microfono' : 'Disattiva microfono'}
                      >
                        {isMuted ? <MicOffIcon /> : <MicIcon />}
                      </button>
                    )}
                    
                    {!isConnected && canCall && (
                      <button
                        type="button"
                        className="voice-control-btn start-call"
                        onClick={() => setShowStartModal(true)}
                      >
                        <PhoneIcon />
                        Avvia chiamata
                      </button>
                    )}
                    
                    {isConnected && (
                      <button
                        type="button"
                        className="voice-control-btn end-call"
                        onClick={() => setShowEndModal(true)}
                      >
                        Termina chiamata
                      </button>
                    )}
                  </div>

                  <div className="voice-status">
                    {!canCall && activeSession.status !== 'ended' && (
                      <span className="voice-expired-hint">
                        Il tempo per questa sessione è terminato.
                      </span>
                    )}
                    {isConnected && isSessionActive && (
                      <div className="voice-active-status">
                        <span className="voice-connected-status">
                          🔴 Chiamata in corso
                        </span>
                        {audioStream && (
                          <span className="voice-audio-status">
                            {isMuted ? '🔇 Microfono spento' : '🎤 Microfono acceso'}
                          </span>
                        )}
                      </div>
                    )}
                    {activeSession.status === 'created' && (
                      <span className="voice-waiting-status">
                        ⏳ In attesa di avviare la chiamata
                      </span>
                    )}
                  </div>
                  
                  {activeSession.status === 'ended' && (
                    <div className="voice-session-details">
                      <h3>Dettagli sessione</h3>
                      <div className="session-details-grid">
                        <div>
                          <span className="detail-label">Inizio chiamata</span>
                          <span>{activeSession.startTime ? dayjs(activeSession.startTime).format('DD MMM YYYY · HH:mm') : '—'}</span>
                        </div>
                        <div>
                          <span className="detail-label">Fine chiamata</span>
                          <span>{activeSession.endTime ? dayjs(activeSession.endTime).format('DD MMM YYYY · HH:mm') : '—'}</span>
                        </div>
                        <div>
                          <span className="detail-label">Durata totale</span>
                          <span>
                            {activeSession.duration ? 
                              `${Math.floor(activeSession.duration / 60)}:${String(activeSession.duration % 60).padStart(2, '0')}` : 
                              '—'
                            }
                          </span>
                        </div>
                        <div>
                          <span className="detail-label">Costo totale</span>
                          <span>
                            {activeSession.cost ? `${(activeSession.cost / 100).toFixed(2)} €` : 'Gratuita'}
                          </span>
                        </div>
                        <div>
                          <span className="detail-label">Tariffa applicata</span>
                          <span>
                            {activeSession.rate ? `${(activeSession.rate / 100).toFixed(2)} €/min` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <aside className="voice-notes">
                <div className="voice-notes-header">
                  <h3>Note personali</h3>
                  <p>Queste note sono private e visibili solo a te. L'altro partecipante non può vederle.</p>
                </div>
                <textarea
                  className="voice-notes-input"
                  value={noteDraft}
                  onChange={event => setNoteDraft(event.target.value)}
                  placeholder="Scrivi note private su questa sessione. Solo tu puoi vederle e modificarle."
                  rows={8}
                  disabled={noteMutation.isPending}
                />
                <div className="voice-notes-footer">
                  <div className="voice-notes-status">
                    {noteMutation.isPending ? (
                      <span>Salvataggio…</span>
                    ) : noteUpdatedAt ? (
                      <span>
                        Ultimo salvataggio {dayjs(noteUpdatedAt).format('DD MMM YYYY · HH:mm')}
                      </span>
                    ) : (
                      <span>Le note non sono ancora state salvate.</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={handleNoteSave}
                    disabled={!isNoteDirty || noteMutation.isPending}
                  >
                    Salva note
                  </button>
                </div>
              </aside>
            </div>
          )}
        </section>
      </div>
      
      <ConfirmModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onConfirm={startCall}
        title="Avvia Chiamata"
        message="Sei sicuro di voler avviare la chiamata vocale? Il timer inizierà a contare e verrai addebitato secondo la tariffa concordata."
        confirmText="Avvia Chiamata"
        cancelText="Annulla"
      />
      
      <ConfirmModal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        onConfirm={endCall}
        title="Termina Chiamata"
        message="Sei sicuro di voler terminare la chiamata? La sessione verrà chiusa definitivamente e non potrà essere ripresa."
        confirmText="Termina Chiamata"
        cancelText="Continua Chiamata"
        type="danger"
      />
    </section>
  );
}