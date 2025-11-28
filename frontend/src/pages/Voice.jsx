import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import ReviewModal from '../components/ReviewModal.jsx';
import useAudioLevel from '../hooks/useAudioLevel.js';
import useSimulatedVoiceActivity from '../hooks/useSimulatedVoiceActivity.js';
import useVoiceWebRTC from '../hooks/useVoiceWebRTC.js';
import { decodeTokenSub } from '../utils/jwt.js';

const toastInfo = (message, options) => toast(message, { icon: 'ℹ️', ...options });
const toastWarning = (message, options) => toast(message, { icon: '⚠️', ...options });

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

const meterOffsets = [0, 0.12, 0.24, 0.36];

const VoiceParticipant = ({ name, role, avatar, fallbackInitial, level, isActive }) => {
  const safeLevel = isActive ? level : 0;
  const speaking = isActive && safeLevel > 0.08;
  const visualizerClass = isActive ? ' visualized' : '';

  return (
    <div className="voice-participant">
      <div className={`voice-avatar${visualizerClass}${speaking ? ' speaking' : ''}`}>
        <span className="voice-visualizer-ring" style={{ '--voice-level': safeLevel }} aria-hidden="true" />
        <span className="voice-visualizer-pulse" style={{ '--voice-level': safeLevel }} aria-hidden="true" />
        {avatar ? (
          <img src={avatar} alt={name} />
        ) : (
          <span>{fallbackInitial}</span>
        )}
      </div>
      <span className="voice-participant-name">{name}</span>
      <span className="voice-participant-role">{role}</span>
      <div className="voice-participant-meter" aria-hidden="true">
        {meterOffsets.map((offset, index) => {
          const value = Math.max(0, Math.min(1, safeLevel - offset));
          return <span key={index} style={{ '--voice-level': value }} />;
        })}
      </div>
    </div>
  );
};

export default function Voice() {
  dayjs.locale('it');
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setTokenState] = useState(() => getToken());
  const queryClient = useQueryClient();
  const socket = useSocket();
  const [socketError, setSocketError] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteBaseline, setNoteBaseline] = useState('');
  const [noteUpdatedAt, setNoteUpdatedAt] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [micPermission, setMicPermission] = useState(null);
  const [audioStream, setAudioStream] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [signalHandler, setSignalHandler] = useState(null);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 1024 : false));
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [mobileNotesOpen, setMobileNotesOpen] = useState(false);
  const joinedSessionRef = useRef(null);
  const manualCallInitiatedRef = useRef(false);
  const autoStartSessionRef = useRef(null);
  const lastConnectionStatusRef = useRef({ status: null, reason: null });

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
    enabled: Boolean(token),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: data => {
      if (!data || !Array.isArray(data)) return false;
      const hasActive = data.some(session => session.status === 'active' || session.status === 'created');
      return hasActive ? 15000 : false;
    },
    refetchIntervalInBackground: true
  });

  const sessionQuery = useQuery({
    queryKey: ['voice', 'session', sessionId],
    queryFn: () => fetchVoiceSession(sessionId),
    enabled: Boolean(token && sessionId),
    staleTime: 15000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: data => (data?.session?.status === 'active' ? 5000 : false),
    refetchIntervalInBackground: true
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileSessionsOpen(false);
      setMobileNotesOpen(false);
    }
  }, [isMobile]);

  const stopAudioStream = useCallback(() => {
    if (audioStream) {
      console.info('[voice] Stopping local audio stream', {
        trackCount: audioStream.getTracks()?.length || 0
      });
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
      setIsMuted(false);
    }
  }, [audioStream]);

  const releasePreviewStream = useCallback(() => {
    if (audioStream) {
      stopAudioStream();
    }
  }, [audioStream, stopAudioStream]);

  useEffect(() => {
    if (!sessionId) {
      setNoteDraft('');
      setNoteBaseline('');
      setNoteUpdatedAt(null);
      setIsConnected(false);
      stopAudioStream();
      setActiveCall(null);
      setMobileNotesOpen(false);
    }
  }, [sessionId]);

  const sessions = useMemo(() => sessionsQuery.data || [], [sessionsQuery.data]);
  const viewerId = useMemo(() => decodeTokenSub(token), [token]);
  
  const { activeSessions, completedSessions } = useMemo(() => {
    const active = sessions.filter(s => s.status === 'active' || s.status === 'created');
    const completed = sessions.filter(s => s.status === 'ended');
    return { activeSessions: active, completedSessions: completed };
  }, [sessions]);

  const activeSession = sessionQuery.data?.session;
  const countdownSeconds = useCountdown(activeSession?.expiresAt);
  const serverRemainingSeconds = activeSession?.remainingSeconds;
  const remainingSeconds = serverRemainingSeconds ?? countdownSeconds;
  const canCall = sessionQuery.data?.canCall && (remainingSeconds == null || remainingSeconds > 0);
  const showMobileOverlay = isMobile && (mobileSessionsOpen || mobileNotesOpen);

  const masterUserId = activeSession?.master?.id || activeSession?.master?._id;
  const customerUserId = activeSession?.customer?.id || activeSession?.customer?._id;

  const isNoteDirty = noteDraft !== noteBaseline;
  const isSessionActive = activeSession?.status === 'active';
  const isSessionEnded = activeSession?.status === 'ended';
  const shouldShowEmpty = !sessionId && sessions.length === 0 && !sessionsQuery.isLoading;
  const rawViewerRole = sessionQuery.data?.viewerRole;
  const resolvedViewerRole = useMemo(() => {
    const masterId = activeSession?.master?.id || activeSession?.master?._id;
    const customerId = activeSession?.customer?.id || activeSession?.customer?._id;

    if (rawViewerRole === 'master' || rawViewerRole === 'expert') return 'master';
    if (rawViewerRole === 'client' || rawViewerRole === 'customer') return 'client';

    if (viewerId && masterId && viewerId === masterId) return 'master';
    if (viewerId && customerId && viewerId === customerId) return 'client';

    return 'client';
  }, [rawViewerRole, activeSession?.master?.id, activeSession?.master?._id, activeSession?.customer?.id, activeSession?.customer?._id, viewerId]);
  const {
    isConnected: webrtcConnected,
    isMuted: webrtcMuted,
    isInitializing: webrtcInitializing,
    localAudio,
    remoteAudio,
    startCall: startWebRTCCall,
    handleSignal: handleWebRTCSignal,
    toggleMute: toggleWebRTCMute,
    endCall: endWebRTCCall,
    error: webrtcError
  } = useVoiceWebRTC(sessionId, resolvedViewerRole, () => {
    setActiveCall(null);
    setIsConnected(false);
  });

  const connectionStatus = useMemo(() => {
    if (webrtcConnected) return 'connected';
    if (webrtcError) return 'error';
    if (webrtcInitializing) return 'initializing';
    if (activeSession?.status === 'active') return 'waiting';
    return 'idle';
  }, [webrtcConnected, webrtcError, webrtcInitializing, activeSession?.status]);
  const connectionPartnerId = useMemo(() => {
    if (!resolvedViewerRole) return null;
    return resolvedViewerRole === 'master' ? customerUserId : masterUserId;
  }, [resolvedViewerRole, masterUserId, customerUserId]);

  const localAudioLevel = useAudioLevel(audioStream, {
    disabled: !audioStream || isMuted || !isConnected || !isSessionActive
  });
  const remoteAudioLevel = useSimulatedVoiceActivity(isConnected && !isSessionEnded);

  useEffect(() => {
    if ((webrtcConnected || webrtcInitializing) && audioStream) {
      stopAudioStream();
    }
  }, [webrtcConnected, webrtcInitializing, audioStream, stopAudioStream]);

  const cleanupSessionResources = useCallback(() => {
    setActiveCall(null);
    setIsConnected(false);
    stopAudioStream();
    endWebRTCCall();
    autoStartSessionRef.current = null;
    joinedSessionRef.current = null;
    manualCallInitiatedRef.current = false;

    if (socket && sessionId) {
      try {
        console.info('[voice] Leaving voice session room (cleanup)', { sessionId });
        socket.emit('voice:session:leave', { sessionId });
      } catch (error) {
        console.error('Failed to leave voice session during cleanup:', error);
      }
    }
  }, [endWebRTCCall, sessionId, socket, stopAudioStream]);

  useEffect(() => {
    if (!sessionId || !activeSession) {
      cleanupSessionResources();
      return;
    }

    if (activeSession.status === 'active') {
      setIsConnected(true);
      if (socket && joinedSessionRef.current !== sessionId) {
        try {
          console.info('[voice] Joining voice session room', { sessionId });
          socket.emit('voice:session:join', { sessionId });
          joinedSessionRef.current = sessionId;
          setSocketError(null);
        } catch (error) {
          console.error('Failed to join voice session:', error);
          setSocketError('Connessione WebSocket non disponibile');
        }
      }
    } else {
      cleanupSessionResources();
    }
  }, [activeSession?.status, cleanupSessionResources, sessionId, socket]);

  const cleanupRef = useRef(cleanupSessionResources);

  useEffect(() => {
    cleanupRef.current = cleanupSessionResources;
  }, [cleanupSessionResources]);

  useEffect(() => () => cleanupRef.current?.(), []);


  useEffect(() => {
    if (!sessionId) return;
    const noteValue = sessionQuery.data?.session?.note ?? '';
    setNoteDraft(noteValue);
    setNoteBaseline(noteValue);
    setNoteUpdatedAt(sessionQuery.data?.noteUpdatedAt || null);
  }, [sessionId, sessionQuery.data?.session?.note, sessionQuery.data?.noteUpdatedAt]);

  // Monitor socket connection status
  useEffect(() => {
    if (socket) {
      const handleConnect = () => {
        console.info('[voice] Socket connected successfully');
        setSocketError(null);
      };
      
      const handleDisconnect = (reason) => {
        console.warn('[voice] Socket disconnected:', reason);
        if (reason === 'io server disconnect') {
          setSocketError('Connessione interrotta dal server');
        } else if (reason === 'transport close') {
          setSocketError('Connessione persa');
        }
      };
      
      const handleConnectError = (error) => {
        console.error('[voice] Socket connection error:', error);
        setSocketError('Impossibile connettersi al server');
      };
      
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleConnectError);
      
      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
      };
    }
  }, [socket]);

  useEffect(() => {
    if (!socket) return undefined;
    
    const handleSessionUpdate = payload => {
      queryClient.invalidateQueries({ queryKey: ['voice', 'sessions'] });
      if (payload.sessionId && payload.sessionId === sessionId) {
        queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
      }
      console.info('[voice] Received voice:session:updated', payload);
    };

    const handleSessionSync = payload => {
      if (payload.sessionId === sessionId) {
        queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
      }
      console.info('[voice] Received voice:session:sync', payload);
    };

    const handleSessionCreated = payload => {
      queryClient.invalidateQueries({ queryKey: ['voice', 'sessions'] });
      if (payload?.sessionId && payload.sessionId === sessionId) {
        queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
      }
      if (payload?.createdBy && payload.createdBy !== viewerId) {
        toast.success('📞 Nuova sessione vocale disponibile');
      }
      console.info('[voice] Received voice:session:created', payload);
    };
    
    const handleSessionStarted = payload => {
      if (payload.sessionId === sessionId) {
        setIsConnected(true);
        toast.success('Chiamata avviata dal partner');
        queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
        
        // Start WebRTC when session is started by partner
        setTimeout(() => {
          if (socket?.connected) {
            console.log('[voice] Starting WebRTC after partner started session');
            releasePreviewStream();
            startWebRTCCall();
          } else {
            console.warn('[voice] Socket not connected, delaying WebRTC start');
            setTimeout(() => {
              if (socket?.connected) {
                releasePreviewStream();
                startWebRTCCall();
              }
            }, 2000);
          }
        }, 1000);
      }
      queryClient.invalidateQueries({ queryKey: ['voice', 'sessions'] });
      console.info('[voice] Received voice:session:started', payload);
    };
    
    const handleSessionEnded = payload => {
      if (payload.sessionId === sessionId) {
        cleanupSessionResources();
        setShowEndModal(false);
        toastInfo('Chiamata terminata dal partner');
        queryClient.setQueryData(['voice', 'session', sessionId], previous => {
          if (!previous?.session) return previous;
          return {
            ...previous,
            session: {
              ...previous.session,
              status: 'ended',
              endTime: payload?.endTime || previous.session.endTime,
              duration: payload?.duration ?? previous.session.duration,
              cost: payload?.cost ?? previous.session.cost
            }
          };
        });
        queryClient.setQueryData(['voice', 'sessions'], previous => {
          if (!Array.isArray(previous)) return previous;
          return previous.map(session =>
            session.id === sessionId
              ? {
                ...session,
                status: 'ended',
                endTime: payload?.endTime || session.endTime,
                duration: payload?.duration ?? session.duration,
                cost: payload?.cost ?? session.cost
              }
              : session
          );
        });
        queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
      }
      queryClient.invalidateQueries({ queryKey: ['voice', 'sessions'] });
      console.info('[voice] Received voice:session:ended', payload);
    };
    
    const handleSessionExpired = payload => {
      if (payload.sessionId === sessionId) {
        cleanupSessionResources();
        setShowEndModal(false);
        toastWarning('⏰ Sessione scaduta automaticamente');
        queryClient.setQueryData(['voice', 'session', sessionId], previous => {
          if (!previous?.session) return previous;
          return {
            ...previous,
            session: {
              ...previous.session,
              status: 'ended'
            }
          };
        });
        queryClient.setQueryData(['voice', 'sessions'], previous => {
          if (!Array.isArray(previous)) return previous;
          return previous.map(session =>
            session.id === sessionId ? { ...session, status: 'ended' } : session
          );
        });
        queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
      }
      queryClient.invalidateQueries({ queryKey: ['voice', 'sessions'] });
      console.info('[voice] Received voice:session:expired', payload);
    };

    const handleParticipantMuted = payload => {
      if (payload.sessionId === sessionId && payload.userId !== viewerId) {
        const participantName = payload.userId === activeSession?.master?.id ? masterName : customerName;
        if (payload.isMuted) {
          toastInfo(`🔇 ${participantName} ha disattivato il microfono`);
        } else {
          toastInfo(`🎤 ${participantName} ha attivato il microfono`);
        }
      }
      console.info('[voice] Received voice:participant:muted', payload);
    };

    // WebRTC call event handlers
    const handleCallIncoming = payload => {
      if (payload.sessionId === sessionId) {
        setActiveCall({ ...payload, isIncoming: true });
      }
    };

    const handleCallOutgoing = payload => {
      if (payload.sessionId === sessionId) {
        setActiveCall({ ...payload, isIncoming: false });
      }
    };

    const handleCallEnded = payload => {
      if (payload.sessionId === sessionId) {
        cleanupSessionResources();
        setShowEndModal(false);
        queryClient.setQueryData(['voice', 'session', sessionId], previous => {
          if (!previous?.session) return previous;
          return {
            ...previous,
            session: {
              ...previous.session,
              status: 'ended',
              duration: payload?.duration ?? previous.session.duration,
              cost: payload?.cost ?? previous.session.cost
            }
          };
        });
        queryClient.setQueryData(['voice', 'sessions'], previous => {
          if (!Array.isArray(previous)) return previous;
          return previous.map(session =>
            session.id === sessionId
              ? {
                ...session,
                status: 'ended',
                duration: payload?.duration ?? session.duration,
                cost: payload?.cost ?? session.cost
              }
              : session
          );
        });
      }
    };

    const handleWebRTCSignal = payload => {
      console.log('[voice] Received WebRTC signal:', payload.type, 'for session:', payload.sessionId, 'current session:', sessionId, 'has handler:', !!signalHandler);
      if (payload.sessionId === sessionId && signalHandler) {
        console.log('[voice] Processing WebRTC signal:', payload.type);
        signalHandler(payload);
      } else if (payload.sessionId === sessionId && !signalHandler) {
        console.warn('[voice] Received WebRTC signal but no handler available');
      }
    };

    const handleConnectionStatus = payload => {
      if (payload.sessionId === sessionId) {
        console.log('[voice] Connection status update:', payload.status, 'for session:', payload.sessionId);
        // Handle connection status updates if needed
      }
    };

    const handleReviewPrompt = payload => {
      if (!payload?.bookingId || payload?.partnerType !== 'master') return;
      setReviewData({
        bookingId: payload.bookingId,
        partnerName: payload.partnerName,
        partnerType: payload.partnerType
      });
      setShowReviewModal(true);
    };

    const handleSessionCompleted = payload => {
      if (!payload?.bookingId || payload?.partnerType !== 'master') return;
      setReviewData({
        bookingId: payload.bookingId,
        partnerName: payload.partnerName,
        partnerType: payload.partnerType
      });
      setShowReviewModal(true);
    };
    
    socket.on('voice:session:updated', handleSessionUpdate);
    socket.on('voice:session:started', handleSessionStarted);
    socket.on('voice:session:ended', handleSessionEnded);
    socket.on('voice:session:expired', handleSessionExpired);
    socket.on('voice:participant:muted', handleParticipantMuted);
    socket.on('voice:session:created', handleSessionCreated);
    socket.on('voice:call:incoming', handleCallIncoming);
    socket.on('voice:call:outgoing', handleCallOutgoing);
    socket.on('voice:call:ended', handleCallEnded);
    socket.on('voice:webrtc:signal', handleWebRTCSignal);
    socket.on('voice:session:connection:status', handleConnectionStatus);
    socket.on('voice:session:sync', handleSessionSync);
    socket.on('session:review:prompt', handleReviewPrompt);
    socket.on('session:completed', handleSessionCompleted);

    return () => {
      socket.off('voice:session:updated', handleSessionUpdate);
      socket.off('voice:session:started', handleSessionStarted);
      socket.off('voice:session:ended', handleSessionEnded);
      socket.off('voice:session:expired', handleSessionExpired);
      socket.off('voice:participant:muted', handleParticipantMuted);
      socket.off('voice:session:created', handleSessionCreated);
      socket.off('voice:call:incoming', handleCallIncoming);
      socket.off('voice:call:outgoing', handleCallOutgoing);
      socket.off('voice:call:ended', handleCallEnded);
      socket.off('voice:webrtc:signal', handleWebRTCSignal);
      socket.off('voice:session:connection:status', handleConnectionStatus);
      socket.off('voice:session:sync', handleSessionSync);
      socket.off('session:review:prompt', handleReviewPrompt);
      socket.off('session:completed', handleSessionCompleted);
    };
  }, [socket, queryClient, sessionId, activeSession, viewerId, signalHandler, cleanupSessionResources, releasePreviewStream]);

  // Set up WebRTC signal handler
  useEffect(() => {
    if (handleWebRTCSignal) {
      console.log('[voice] Setting up WebRTC signal handler for session:', sessionId);
      setSignalHandler(() => handleWebRTCSignal);
    }
  }, [handleWebRTCSignal, sessionId]);

  useEffect(() => {
    if (!socket || !sessionId || !connectionPartnerId) return;
    const reason = webrtcError || null;
    const previous = lastConnectionStatusRef.current;
    if (previous.status === connectionStatus && previous.reason === reason) return;

    try {
      console.info('[voice] Emitting connection status update', {
        sessionId,
        status: connectionStatus,
        reason,
        targetUserId: connectionPartnerId
      });
      socket.emit('voice:session:connection:update', {
        sessionId,
        status: connectionStatus,
        reason,
        targetUserId: connectionPartnerId
      });
    } catch (error) {
      console.error('[voice] Failed to emit connection status update', error);
    }

    lastConnectionStatusRef.current = { status: connectionStatus, reason };
  }, [socket, sessionId, connectionPartnerId, connectionStatus, webrtcError]);

  // Ensure WebRTC only starts once the viewer role is known
  useEffect(() => {
    if (manualCallInitiatedRef.current) {
      console.info('[voice] Manual call already in progress; auto-start skipped');
      return;
    }
    if (!resolvedViewerRole || resolvedViewerRole !== 'master' || !sessionId || !isSessionActive || !isConnected) return;
    if (webrtcConnected || webrtcInitializing) return;
    if (autoStartSessionRef.current === sessionId) {
      return;
    }

    console.info('[voice] Viewer role resolved, (re)starting WebRTC', { viewerRole: resolvedViewerRole, sessionId });
    autoStartSessionRef.current = sessionId;
    releasePreviewStream();
    startWebRTCCall();
  }, [resolvedViewerRole, sessionId, isSessionActive, isConnected, webrtcConnected, webrtcInitializing, startWebRTCCall, releasePreviewStream]);

  // Remove auto-start WebRTC - require manual initiation
  // WebRTC will only start when user clicks "Avvia chiamata" button

  useEffect(() => {
    if (sessionId && isMobile) {
      setMobileSessionsOpen(false);
    }
  }, [sessionId, isMobile]);

  useEffect(() => {
    if (isMobile && activeCall) {
      setMobileNotesOpen(true);
    }
  }, [isMobile, activeCall?.sessionId]);

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
      console.info('[voice] Microphone permission granted', {
        trackCount: stream.getAudioTracks()?.length || 0
      });
      setAudioStream(stream);
      setMicPermission('granted');
      return true;
    } catch (error) {
      setMicPermission('denied');
      console.error('[voice] Microphone permission denied', { message: error.message });
      toast.error('Accesso al microfono negato. Abilita il microfono nelle impostazioni del browser.');
      return false;
    }
  };

  const toggleMute = () => {
    if (webrtcConnected) {
      toggleWebRTCMute();
      const newMutedState = !webrtcMuted;
      
      if (newMutedState) {
        toastInfo('🔇 Microfono disattivato');
      } else {
        toast.success('🎤 Microfono attivato');
      }
      
      if (socket && sessionId) {
        try {
          socket.emit('voice:mute:toggle', { sessionId, isMuted: newMutedState });
        } catch (error) {
          console.error('Failed to emit mute toggle:', error);
        }
      }
    } else if (audioStream) {
      const newMutedState = !isMuted;
      setIsMuted(newMutedState);
      
      audioStream.getAudioTracks().forEach(track => {
        track.enabled = !newMutedState;
      });
      
      if (newMutedState) {
        toastInfo('🔇 Microfono disattivato');
      } else {
        toast.success('🎤 Microfono attivato');
      }
      
      if (socket && sessionId) {
        try {
          socket.emit('voice:mute:toggle', { sessionId, isMuted: newMutedState });
        } catch (error) {
          console.error('Failed to emit mute toggle:', error);
        }
      }
    }
  };

  const startCall = async () => {
    if (manualCallInitiatedRef.current) {
      console.info('[voice] Start call already in progress; ignoring extra request');
      return;
    }
    manualCallInitiatedRef.current = true;
    console.info('[voice] Attempting to start voice call', { sessionId });
    
    try {
      // First start the session via API
      const response = await client.post(`/voice/session/${sessionId}/start`);
      setShowStartModal(false);
      toast.success('Chiamata avviata');
      queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
      
      // Release any preview stream so the WebRTC call can grab the mic
      releasePreviewStream();

      // Then start WebRTC connection after ensuring socket is ready
      setTimeout(() => {
        if (socket?.connected) {
          console.log('[voice] Starting WebRTC after session start');
          releasePreviewStream();
          startWebRTCCall();
        } else {
          console.warn('[voice] Socket not connected, delaying WebRTC start');
          setTimeout(() => {
            if (socket?.connected) {
              releasePreviewStream();
              startWebRTCCall();
            }
          }, 2000);
        }
      }, 1000);
      
      console.info('[voice] Voice call start API succeeded', { sessionId, status: response.data?.status });
    } catch (error) {
      const message = error?.response?.data?.message || 'Impossibile avviare la chiamata';
      toast.error(message);
      setShowStartModal(false);
      manualCallInitiatedRef.current = false;
      console.error('[voice] Voice call start API failed', {
        sessionId,
        message: error?.response?.data?.message || error.message
      });
    }
  };

  // Auto-request mic permission when session becomes active
  useEffect(() => {
    if (
      !isSessionActive ||
      audioStream ||
      micPermission === 'denied' ||
      manualCallInitiatedRef.current ||
      webrtcInitializing ||
      webrtcConnected
    ) {
      return;
    }

    requestMicPermission();
  }, [audioStream, isSessionActive, micPermission, webrtcConnected, webrtcInitializing]);

  const endCall = async () => {
    try {
      const response = await client.post(`/voice/session/${sessionId}/end`);
      cleanupSessionResources();
      setShowEndModal(false);
      toast.success('Chiamata terminata');
      queryClient.invalidateQueries({ queryKey: ['voice', 'session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['voice', 'sessions'] });
      console.info('[voice] Voice call end API succeeded', { sessionId, status: response.data?.status });
    } catch (error) {
      const message = error?.response?.data?.message || 'Errore durante la chiusura della chiamata';
      toast.error(message);
      setShowEndModal(false);
      console.error('[voice] Voice call end API failed', {
        sessionId,
        message: error?.response?.data?.message || error.message
      });
    }
  };

  const masterName = activeSession?.master?.name || 'Esperti Rivelya';
  const masterAvatar = activeSession?.master?.avatarUrl || '';
  const masterInitial = masterName.charAt(0).toUpperCase();
  const customerName = activeSession?.customer?.name || 'Cliente Rivelya';
  const customerAvatar = activeSession?.customer?.avatarUrl || '';
  const customerInitial = customerName.charAt(0).toUpperCase();
  const masterAudioLevel = resolvedViewerRole === 'master' ? localAudioLevel : remoteAudioLevel;
  const customerAudioLevel = resolvedViewerRole === 'client' ? localAudioLevel : remoteAudioLevel;
  const actuallyConnected = webrtcConnected || isConnected;
  const actuallyMuted = webrtcConnected ? webrtcMuted : isMuted;
  const showVoiceVisualization = isSessionActive && actuallyConnected;
  const masterDisplayLevel = showVoiceVisualization ? masterAudioLevel : 0;
  const customerDisplayLevel = showVoiceVisualization ? customerAudioLevel : 0;
  const canTerminateCall = actuallyConnected && isSessionActive && resolvedViewerRole === 'client';
  const canToggleMute = isSessionActive && (webrtcConnected || audioStream || isConnected);

  return (
    <section className="voice-page">
      <div className="voice-layout">
        <aside className={`voice-sidebar${isMobile ? ' mobile-sheet' : ''}${mobileSessionsOpen ? ' open' : ''}`}>
          {isMobile && (
            <div className="voice-sheet-header">
              <h2>Chiamate</h2>
              <button
                type="button"
                className="voice-sheet-close"
                onClick={() => setMobileSessionsOpen(false)}
                aria-label="Chiudi elenco chiamate"
              >
                <span aria-hidden="true">←</span>
                <span className="sheet-close-label">Indietro</span>
              </button>
            </div>
          )}
          <div className="voice-sidebar-header">
            <h1>Chiamate Vocali</h1>
            <p>Gestisci le tue sessioni vocali e rivedi la cronologia delle conversazioni.</p>
            {isMobile && (
              <button
                type="button"
                className="sheet-inline-close"
                onClick={() => setMobileSessionsOpen(false)}
                aria-label="Chiudi elenco chiamate"
              >
                ×
              </button>
            )}
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
          {isMobile && (
            <div className="voice-mobile-bar">
              <button
                type="button"
                className="voice-mobile-btn"
                onClick={() => {
                  setMobileSessionsOpen(true);
                  setMobileNotesOpen(false);
                }}
              >
              Chiamate
              </button>
              <button
                type="button"
                className={`voice-mobile-btn ghost${activeCall ? ' alert' : ''}`}
                onClick={() => {
                  setMobileNotesOpen(true);
                  setMobileSessionsOpen(false);
                }}
              >
                {activeCall ? 'Chiamata/Note' : ' Note'}
              </button>
            </div>
          )}
          {shouldShowEmpty && (
            <div className="voice-empty-card">
              <h2>Nessuna chiamata vocale</h2>
              <p>Non hai ancora effettuato chiamate vocali. Visita il profilo di un master per iniziare una sessione vocale e iniziare a consultarti in tempo reale.</p>
              <button 
                type="button" 
                className="btn primary"
                onClick={() => navigate('/catalog')}
              >
                Esplora Esperti
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

              <div className="voice-room-main">
                <div className="voice-call-area">
                  <div className="voice-participants">
                    <VoiceParticipant
                      name={masterName}
                      role="Esperti"
                      avatar={masterAvatar}
                      fallbackInitial={masterInitial}
                      level={masterDisplayLevel}
                      isActive={showVoiceVisualization}
                    />
                    <VoiceParticipant
                      name={customerName}
                      role="Cliente"
                      avatar={customerAvatar}
                      fallbackInitial={customerInitial}
                      level={customerDisplayLevel}
                      isActive={showVoiceVisualization}
                    />
                  </div>

                  <div className="voice-controls">
                    <audio ref={localAudio} muted autoPlay playsInline />
                    <audio ref={remoteAudio} autoPlay playsInline />
                    
                    {!actuallyConnected && canCall && (
                      <button
                        type="button"
                        className="voice-control-btn start-call"
                        onClick={() => setShowStartModal(true)}
                      >
                        <PhoneIcon />
                        Avvia chiamata
                      </button>
                    )}
                    
                    {canToggleMute && (
                      <>
                        <button
                          type="button"
                          className={`voice-control-btn ${actuallyMuted ? 'muted' : ''}`}
                          onClick={toggleMute}
                          title={actuallyMuted ? 'Attiva microfono' : 'Disattiva microfono'}
                        >
                          {actuallyMuted ? <MicOffIcon /> : <MicIcon />}
                        </button>
                        {canTerminateCall && (
                          <button
                            type="button"
                            className="voice-control-btn end-call"
                            onClick={() => setShowEndModal(true)}
                          >
                            Termina chiamata
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div className="voice-status">
                    {/* Debug info */}
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                      Socket: {socket?.connected ? '🟢 Connesso' : '🔴 Disconnesso'} | 
                      Session: {activeSession?.status} | 
                      Role: {resolvedViewerRole} | 
                      Handler: {signalHandler ? '✅' : '❌'}
                    </div>
                    
                    {(socketError || webrtcError) && (
                      <span className="voice-error-hint">
                        ⚠️ {socketError || webrtcError}
                      </span>
                    )}
                    {!canCall && activeSession.status !== 'ended' && (
                      <span className="voice-expired-hint">
                        Il tempo per questa sessione è terminato.
                      </span>
                    )}
                    {actuallyConnected && isSessionActive && (
                      <div className="voice-active-status">
                        <span className="voice-connected-status">
                          🔴 Chiamata in corso {webrtcConnected ? '(WebRTC)' : ''}
                        </span>
                        {(audioStream || webrtcConnected) && (
                          <span className="voice-audio-status">
                            {actuallyMuted ? '🔇 Microfono spento' : '🎤 Microfono acceso'}
                          </span>
                        )}
                      </div>
                    )}
                    {webrtcConnected && (
                      <span className="voice-success-status">
                        ✅ Connessione WebRTC stabilita
                      </span>
                    )}
                    {(webrtcInitializing || (isSessionActive && !webrtcConnected)) && (
                      <span className="voice-waiting-status">
                        🔄 Connessione WebRTC in corso...
                      </span>
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
            </div>
          )}
        </section>

        <aside className={`voice-sidebar-panel${isMobile ? ' mobile-sheet' : ''}${mobileNotesOpen ? ' open' : ''}`}>
          {isMobile && (
            <div className="voice-sheet-header">
              <h2>Note</h2>
              <button
                type="button"
                className="voice-sheet-close"
                onClick={() => setMobileNotesOpen(false)}
                aria-label="Chiudi pannello note"
              >
                <span aria-hidden="true">←</span>
                <span className="sheet-close-label">Indietro</span>
              </button>
            </div>
          )}
          <div className="voice-notes">
            <div className="voice-notes-header">
              <h3>Note personali</h3>
              <p>Queste note sono private e visibili solo a te. L'altro partecipante non può vederle.</p>
              {isMobile && (
                <button
                  type="button"
                  className="sheet-inline-close"
                  onClick={() => setMobileNotesOpen(false)}
                  aria-label="Chiudi note"
                >
                  ×
                </button>
              )}
            </div>
            <div className="voice-notes-body">
              {sessionId && activeSession ? (
                <textarea
                  className="voice-notes-input"
                  value={noteDraft}
                  onChange={event => setNoteDraft(event.target.value)}
                  placeholder="Scrivi note private su questa sessione. Solo tu puoi vederle e modificarle."
                  rows={8}
                  disabled={noteMutation.isPending}
                />
              ) : (
                <div className="voice-notes-empty">
                  <p>Seleziona una sessione vocale per aggiungere note personali.</p>
                </div>
              )}
            </div>
            {sessionId && activeSession && (
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
            )}
          </div>
        </aside>
      </div>

      {showMobileOverlay && (
        <div
          className="voice-drawer-scrim"
          onClick={() => {
            setMobileSessionsOpen(false);
            setMobileNotesOpen(false);
          }}
          aria-label="Chiudi pannelli mobili"
        />
      )}
      
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
      
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setReviewData(null);
        }}
        bookingId={reviewData?.bookingId}
        partnerName={reviewData?.partnerName}
        partnerType={reviewData?.partnerType}
      />
    </section>
  );
}
