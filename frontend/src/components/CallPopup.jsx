import { useState, useEffect } from 'react';
import useWebRTC from '../hooks/useWebRTC.js';

const PhoneIcon = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const PhoneOffIcon = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
    <line x1="22" x2="2" y1="2" y2="22"/>
  </svg>
);

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

export default function CallPopup({ 
  call, 
  threadId,
  isIncoming,
  onAccept,
  onReject,
  onEnd,
  onSignal,
  partnerName,
  partnerAvatar,
  variant = 'floating'
}) {
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState(null);

  useEffect(() => {
    if (!call) {
      setCallDuration(0);
      setCallStartTime(null);
    }
  }, [call?.callId]);

  const {
    isConnected,
    isMuted,
    localAudio,
    remoteAudio,
    startCall,
    handleSignal,
    toggleMute,
    endCall,
    error
  } = useWebRTC(threadId, call?.callId, !isIncoming, () => {
    onEnd();
  });

  // Handle call duration timer
  useEffect(() => {
    if (call?.status === 'accepted') {
      const resolvedStart = call.startedAt ? new Date(call.startedAt).getTime() : Date.now();
      setCallStartTime(previous => previous || resolvedStart);
    }
  }, [call?.status, call?.startedAt]);

  useEffect(() => {
    let interval;
    if (callStartTime && call?.status === 'accepted') {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStartTime, call?.status]);

  // Handle WebRTC signals
  useEffect(() => {
    if (onSignal && handleSignal) {
      onSignal(handleSignal);
      return () => {
        onSignal(null);
      };
    }
    return undefined;
  }, [onSignal, handleSignal]);

  // Connect audio streams to elements when they change
  useEffect(() => {
    if (localAudio.current && localAudio.current.srcObject) {
      localAudio.current.muted = true; // Prevent feedback
    }
  }, [localAudio.current?.srcObject]);

  useEffect(() => {
    if (remoteAudio.current && remoteAudio.current.srcObject) {
      remoteAudio.current.play().catch(e => console.warn('Remote audio play failed:', e));
    }
  }, [remoteAudio.current?.srcObject]);

  // Auto-start call when accepted
  useEffect(() => {
    if (call?.status === 'accepted' && startCall) {
      console.log('[CallPopup] Call accepted, starting WebRTC connection');
      // Start immediately without checking isConnected to ensure both sides start
      startCall();
    }
  }, [call?.status, startCall]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAccept = () => {
    onAccept();
  };

  const handleReject = () => {
    onReject();
    endCall();
  };

  const handleEnd = () => {
    onEnd();
    endCall();
  };

  if (!call) return null;

  const containerClass = `call-popup${variant === 'sidebar' ? ' sidebar' : ''}`;

  return (
    <div className={containerClass}>
      <audio ref={localAudio} muted autoPlay playsInline />
      <audio ref={remoteAudio} autoPlay playsInline />
      
      <div className="call-popup-content">
        <div className="call-info">
          <div className="call-avatar">
            {partnerAvatar ? (
              <img src={partnerAvatar} alt={partnerName || 'Utente'} />
            ) : (
              <span>{partnerName?.charAt(0)?.toUpperCase() || 'U'}</span>
            )}
          </div>
          <div className="call-details">
            <h3>{partnerName || 'Utente'}</h3>
            <p className="call-status">
              {call.status === 'calling' && isIncoming && 'Chiamata in arrivo...'}
              {call.status === 'calling' && !isIncoming && 'Chiamata in corso...'}
              {call.status === 'accepted' && isConnected && `In chiamata • ${formatDuration(callDuration)}`}
              {call.status === 'accepted' && !isConnected && 'Connessione...'}
              {call.status === 'rejected' && 'Chiamata rifiutata'}
              {call.status === 'ended' && 'Chiamata terminata'}
              {call.status === 'timeout' && 'Chiamata scaduta'}
            </p>
            {error && <p className="call-error">{error}</p>}
          </div>
        </div>

        <div className="call-controls">
          {call.status === 'calling' && isIncoming && (
            <>
              <button 
                className="call-btn accept" 
                onClick={handleAccept}
                title="Accetta chiamata"
              >
                <PhoneIcon />
              </button>
              <button 
                className="call-btn reject" 
                onClick={handleReject}
                title="Rifiuta chiamata"
              >
                <PhoneOffIcon />
              </button>
            </>
          )}

          {call.status === 'calling' && !isIncoming && (
            <button 
              className="call-btn reject" 
              onClick={handleEnd}
              title="Termina chiamata"
            >
              <PhoneOffIcon />
            </button>
          )}

          {call.status === 'accepted' && (
            <>
              <button 
                className={`call-btn mute ${isMuted ? 'active' : ''}`}
                onClick={toggleMute}
                title={isMuted ? 'Attiva microfono' : 'Disattiva microfono'}
              >
                {isMuted ? <MicOffIcon /> : <MicIcon />}
              </button>
              <button 
                className="call-btn end" 
                onClick={handleEnd}
                title="Termina chiamata"
              >
                <PhoneOffIcon />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}