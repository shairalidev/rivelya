import { useEffect, useRef, useState, useCallback } from 'react';
import client from '../api/client.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export default function useVoiceWebRTC(sessionId, viewerRole, onCallEnd) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const micPermissionState = useRef('unknown');

  const peerConnection = useRef(null);
  const isStartingRef = useRef(false);
  const hasStartedRef = useRef(false);
  const localAudio = useRef(null);
  const remoteAudio = useRef(null);
  const normalizedViewerRole = viewerRole === 'expert' ? 'master' : viewerRole;

  const cleanup = useCallback(() => {
    console.log('[VoiceWebRTC] Cleaning up connection');
    
    // Stop any ongoing initialization
    isStartingRef.current = false;
    hasStartedRef.current = false;
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      // Check if already closed to avoid errors
      if (peerConnection.current.signalingState !== 'closed') {
        peerConnection.current.close();
      }
      peerConnection.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setError(null);
    setIsInitializing(false);
  }, [localStream]);

  const requestMicrophoneAccess = useCallback(async () => {
    if (localStream) {
      return localStream;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia not supported');
    }

    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: 'microphone' });
        micPermissionState.current = status.state;
        if (status.state === 'denied') {
          throw new DOMException('Microphone permission denied', 'NotAllowedError');
        }
        if (status.state === 'prompt') {
          setError('Consenti l\'accesso al microfono per avviare la chiamata.');
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      micPermissionState.current = 'granted';
      setLocalStream(stream);
      if (localAudio.current) {
        localAudio.current.srcObject = stream;
        localAudio.current.muted = true;
      }

      return stream;
    } catch (error) {
      console.error('[VoiceWebRTC] Failed to acquire microphone:', error);
      if (error.name === 'NotAllowedError') {
        setError('Accesso al microfono negato');
      } else if (error.name === 'NotFoundError') {
        setError('Nessun microfono trovato. Controlla che sia collegato.');
      } else if (error.name === 'NotReadableError') {
        setError('Microfono in uso da un\'altra applicazione.');
      } else {
        setError('Impossibile accedere al microfono');
      }
      throw error;
    }
  }, [localStream, setError]);

  const sendSignal = useCallback(async (type, data) => {
    if (!sessionId) {
      console.warn('[VoiceWebRTC] Cannot send signal - no sessionId');
      return;
    }
    
    try {
      console.log('[VoiceWebRTC] Sending signal:', type, 'to session:', sessionId);
      const response = await client.post(`/voice/session/${sessionId}/signal`, { type, data });
      console.log('[VoiceWebRTC] Signal sent successfully:', type, response.status);
    } catch (error) {
      console.error('[VoiceWebRTC] Failed to send signal:', type, error.response?.status, error.response?.data?.message || error.message);
      setError('Errore di connessione durante la chiamata: ' + (error.response?.data?.message || error.message));
    }
  }, [sessionId]);

  const initializePeerConnection = useCallback(() => {
    console.log('[VoiceWebRTC] Initializing peer connection');
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[VoiceWebRTC] Sending ICE candidate');
        sendSignal('ice-candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      console.log('[VoiceWebRTC] Received remote stream');
      setRemoteStream(stream);
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = stream;
        remoteAudio.current.play().catch(e => console.warn('[VoiceWebRTC] Remote audio play failed:', e));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[VoiceWebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnected(true);
        setError(null);
      } else if (pc.connectionState === 'failed') {
        setIsConnected(false);
        setError('Connessione fallita. Riprova.');
        // Attempt to restart the connection after a delay
        setTimeout(() => {
          if (peerConnection.current === pc && sessionId) {
            console.log('[VoiceWebRTC] Attempting to restart connection after failure');
            cleanup();
            // Don't auto-restart to avoid infinite loops
            setError('Connessione persa. Riavvia la chiamata per riconnetterti.');
          }
        }, 2000);
      } else if (pc.connectionState === 'disconnected') {
        setIsConnected(false);
        console.log('[VoiceWebRTC] Connection disconnected, waiting for reconnection...');
      }
    };

    return pc;
  }, [sendSignal]);

  const startCall = useCallback(async ({ skipOffer = false } = {}) => {
    if (isInitializing || peerConnection.current || isStartingRef.current || hasStartedRef.current) {
      console.log('[VoiceWebRTC] Call already initializing, active, or previously started');
      return;
    }

    if (!normalizedViewerRole) {
      console.warn('[VoiceWebRTC] Cannot start call - viewerRole not resolved yet');
      return;
    }

    try {
      setIsInitializing(true);
      isStartingRef.current = true;
      hasStartedRef.current = true;
      setError(null);
      console.log('[VoiceWebRTC] Starting call, viewerRole:', normalizedViewerRole, 'sessionId:', sessionId, 'skipOffer:', skipOffer);
      
      const stream = await requestMicrophoneAccess();
      console.log('[VoiceWebRTC] Got local stream, tracks:', stream.getTracks().length);

      const pc = initializePeerConnection();
      peerConnection.current = pc;

      // Check if connection is still valid before proceeding
      if (pc.signalingState === 'closed') {
        console.warn('[VoiceWebRTC] Peer connection closed during initialization');
        return;
      }

      stream.getTracks().forEach(track => {
        console.log('[VoiceWebRTC] Adding track:', track.kind);
        pc.addTrack(track, stream);
      });

      // Wait a bit for ICE gathering to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check connection state again before creating offer
      if (pc.signalingState === 'closed') {
        console.warn('[VoiceWebRTC] Peer connection closed before creating offer');
        return;
      }

      // Esperti always initiates the WebRTC connection unless we're
      // starting in response to an incoming signal (skipOffer=true)
      if (normalizedViewerRole === 'master' && !skipOffer) {
        console.log('[VoiceWebRTC] Creating offer as master');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        
        // Check state before setting local description
        if (pc.signalingState === 'closed') {
          console.warn('[VoiceWebRTC] Peer connection closed before setting local description');
          return;
        }
        
        await pc.setLocalDescription(offer);
        console.log('[VoiceWebRTC] Local description set, sending offer to session:', sessionId);
        await sendSignal('offer', offer);
      } else {
        console.log('[VoiceWebRTC] Waiting for offer as client, sessionId:', sessionId);
      }

    } catch (error) {
      console.error('[VoiceWebRTC] Failed to start call:', error);
      cleanup();
    } finally {
      setIsInitializing(false);
      isStartingRef.current = false;
    }
  }, [normalizedViewerRole, sessionId, isInitializing, initializePeerConnection, sendSignal, cleanup, requestMicrophoneAccess]);

  const handleSignal = useCallback(async (signal) => {
    if (!signal?.type) {
      console.warn('[VoiceWebRTC] Ignoring invalid signal payload', signal);
      return;
    }

    console.log('[VoiceWebRTC] Handling signal:', signal.type, 'hasPC:', !!peerConnection.current);

    if (!peerConnection.current) {
      console.log('[VoiceWebRTC] No peer connection yet, starting before handling signal');
      await startCall({ skipOffer: true });
      // Wait a bit for the peer connection to be established
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    try {
      const pc = peerConnection.current;

      if (!pc || pc.signalingState === 'closed') {
        console.warn('[VoiceWebRTC] Peer connection unavailable or closed for signal handling');
        return;
      }

      switch (signal.type) {
        case 'offer':
          if (!signal.data) {
            console.warn('[VoiceWebRTC] Missing offer data in signal');
            return;
          }
          if (pc.signalingState === 'closed') {
            console.warn('[VoiceWebRTC] Cannot handle offer, connection closed');
            return;
          }
          console.log('[VoiceWebRTC] Received offer, setting remote description and creating answer');
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
          
          if (pc.signalingState === 'closed') {
            console.warn('[VoiceWebRTC] Connection closed after setting remote description');
            return;
          }
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log('[VoiceWebRTC] Sending answer');
          await sendSignal('answer', answer);
          break;

        case 'answer':
          if (!signal.data) {
            console.warn('[VoiceWebRTC] Missing answer data in signal');
            return;
          }
          if (pc.signalingState === 'closed') {
            console.warn('[VoiceWebRTC] Cannot handle answer, connection closed');
            return;
          }
          if (pc.remoteDescription?.type === 'answer') {
            console.warn('[VoiceWebRTC] Remote answer already applied, ignoring duplicate');
            return;
          }

          console.log('[VoiceWebRTC] Received answer, setting remote description');
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
          break;

        case 'ice-candidate':
          if (!signal.data) {
            console.warn('[VoiceWebRTC] Missing ICE candidate data in signal');
            return;
          }
          if (pc.signalingState === 'closed') {
            console.warn('[VoiceWebRTC] Cannot handle ICE candidate, connection closed');
            return;
          }
          console.log('[VoiceWebRTC] Received ICE candidate, adding to peer connection');
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.data));
          } else {
            console.log('[VoiceWebRTC] Queuing ICE candidate until remote description is set');
            // Queue the candidate for later
            setTimeout(async () => {
              if (pc.remoteDescription && pc.signalingState !== 'closed') {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(signal.data));
                } catch (e) {
                  console.warn('[VoiceWebRTC] Failed to add queued ICE candidate:', e);
                }
              }
            }, 1000);
          }
          break;
      }
    } catch (error) {
      console.error('[VoiceWebRTC] Failed to handle signal:', error);
      setError('Errore durante la negoziazione: ' + error.message);
    }
  }, [sendSignal, startCall]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  }, [localStream, isMuted]);

  const endCall = useCallback(() => {
    hasStartedRef.current = false;
    cleanup();
    if (onCallEnd) {
      onCallEnd();
    }
  }, [cleanup, onCallEnd]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isConnected,
    isMuted,
    localStream,
    remoteStream,
    error,
    isInitializing,
    localAudio,
    remoteAudio,
    startCall,
    handleSignal,
    toggleMute,
    endCall
  };
}
