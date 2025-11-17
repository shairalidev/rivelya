import { useEffect, useRef, useState, useCallback } from 'react';
import client from '../api/client.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export default function useVoiceWebRTC(sessionId, isInitiator, onCallEnd) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState(null);
  
  const peerConnection = useRef(null);
  const localAudio = useRef(null);
  const remoteAudio = useRef(null);

  const cleanup = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setError(null);
  }, [localStream]);

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

  const startCall = useCallback(async () => {
    try {
      setError(null);
      console.log('[VoiceWebRTC] Starting call');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      setLocalStream(stream);
      console.log('[VoiceWebRTC] Got local stream');
      
      if (localAudio.current) {
        localAudio.current.srcObject = stream;
        localAudio.current.muted = true;
      }

      const pc = initializePeerConnection();
      peerConnection.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      if (isInitiator) {
        console.log('[VoiceWebRTC] Creating offer');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal('offer', offer);
      }

    } catch (error) {
      console.error('[VoiceWebRTC] Failed to start call:', error);
      if (error.name === 'NotAllowedError') {
        setError('Accesso al microfono negato');
      } else {
        setError('Impossibile accedere al microfono');
      }
      cleanup();
    }
  }, [isInitiator, initializePeerConnection, sendSignal, cleanup]);

  const handleSignal = useCallback(async (signal) => {
    if (!peerConnection.current) return;

    try {
      const pc = peerConnection.current;

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
  }, [sendSignal]);

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
    localAudio,
    remoteAudio,
    startCall,
    handleSignal,
    toggleMute,
    endCall
  };
}