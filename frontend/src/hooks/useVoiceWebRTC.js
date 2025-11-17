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
  const localAudio = useRef(null);
  const remoteAudio = useRef(null);

  const cleanup = useCallback(() => {
    console.log('[VoiceWebRTC] Cleaning up connection');
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
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
    if (!sessionId) return;
    
    try {
      await client.post(`/voice/session/${sessionId}/signal`, { type, data });
    } catch (error) {
      console.error('[VoiceWebRTC] Failed to send signal:', error);
      setError('Errore di connessione durante la chiamata');
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
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setIsConnected(false);
        if (pc.connectionState === 'failed') {
          setError('Connessione fallita');
        }
      }
    };

    return pc;
  }, [sendSignal]);

  const startCall = useCallback(async ({ skipOffer = false } = {}) => {
    if (isInitializing || peerConnection.current) {
      console.log('[VoiceWebRTC] Call already initializing or active');
      return;
    }

    try {
      setIsInitializing(true);
      setError(null);
      console.log('[VoiceWebRTC] Starting call, viewerRole:', viewerRole, 'sessionId:', sessionId);
      
      const stream = await requestMicrophoneAccess();
      console.log('[VoiceWebRTC] Got local stream, tracks:', stream.getTracks().length);

      const pc = initializePeerConnection();
      peerConnection.current = pc;

      stream.getTracks().forEach(track => {
        console.log('[VoiceWebRTC] Adding track:', track.kind);
        pc.addTrack(track, stream);
      });

      // Master always initiates the WebRTC connection unless we're
      // starting in response to an incoming signal (skipOffer=true)
      if (viewerRole === 'master' && !skipOffer) {
        console.log('[VoiceWebRTC] Creating offer as master');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        await pc.setLocalDescription(offer);
        console.log('[VoiceWebRTC] Sending offer:', offer.type);
        await sendSignal('offer', offer);
      } else {
        console.log('[VoiceWebRTC] Waiting for offer as client');
      }

    } catch (error) {
      console.error('[VoiceWebRTC] Failed to start call:', error);
      cleanup();
    } finally {
      setIsInitializing(false);
    }
  }, [viewerRole, sessionId, isInitializing, initializePeerConnection, sendSignal, cleanup, requestMicrophoneAccess]);

  const handleSignal = useCallback(async (signal) => {
    if (!peerConnection.current) {
      console.log('[VoiceWebRTC] No peer connection yet, starting before handling signal');
      await startCall({ skipOffer: true });
    }

    try {
      const pc = peerConnection.current;

      if (!pc) {
        console.warn('[VoiceWebRTC] Peer connection unavailable for signal handling');
        return;
      }

      switch (signal.type) {
        case 'offer':
          console.log('[VoiceWebRTC] Received offer');
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal('answer', answer);
          break;

        case 'answer':
          console.log('[VoiceWebRTC] Received answer');
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
          break;

        case 'ice-candidate':
          console.log('[VoiceWebRTC] Received ICE candidate');
          await pc.addIceCandidate(new RTCIceCandidate(signal.data));
          break;
      }
    } catch (error) {
      console.error('[VoiceWebRTC] Failed to handle signal:', error);
      setError('Errore durante la negoziazione');
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