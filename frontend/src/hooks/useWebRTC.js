import { useEffect, useRef, useState, useCallback } from 'react';
import client from '../api/client.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export default function useWebRTC(threadId, callId, isInitiator, onCallEnd) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const peerConnection = useRef(null);
  const localAudio = useRef(null);
  const remoteAudio = useRef(null);
  const micPermissionState = useRef('unknown');

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
    setIsMuted(false);
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
        // Don't play local audio to avoid feedback
        localAudio.current.muted = true;
      }

      return stream;
    } catch (error) {
      console.error('[WebRTC] Failed to acquire microphone:', error);
      if (error.name === 'NotAllowedError') {
        setError('Accesso al microfono negato. Controlla le impostazioni del browser.');
      } else if (error.name === 'NotFoundError') {
        setError('Nessun microfono trovato. Controlla che sia collegato.');
      } else if (error.name === 'NotReadableError') {
        setError('Microfono in uso da un\'altra applicazione.');
      } else {
        setError('Impossibile accedere al microfono: ' + error.message);
      }
      throw error;
    }
  }, [localStream]);

  const sendSignal = useCallback(async (type, data) => {
    if (!threadId || !callId) return;
    
    try {
      await client.post(`/chat/threads/${threadId}/call/${callId}/signal`, {
        type,
        data
      });
    } catch (error) {
      console.error('Failed to send signal:', error);
      setError('Errore di connessione durante la chiamata');
    }
  }, [threadId, callId]);

  const initializePeerConnection = useCallback(() => {
    console.log('[WebRTC] Initializing peer connection with ICE servers:', ICE_SERVERS);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Sending ICE candidate:', event.candidate);
        sendSignal('ice-candidate', event.candidate);
      } else {
        console.log('[WebRTC] ICE gathering complete');
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      console.log('[WebRTC] Received remote stream:', stream, 'tracks:', stream.getTracks());
      setRemoteStream(stream);
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = stream;
        remoteAudio.current.play().catch(e => console.warn('[WebRTC] Remote audio play failed:', e));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state changed:', pc.connectionState);
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

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state changed:', pc.iceConnectionState);
    };

    pc.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state changed:', pc.iceGatheringState);
    };

    return pc;
  }, [sendSignal]);

  const startCall = useCallback(async ({ skipOffer = false } = {}) => {
    if (isInitializing || peerConnection.current) {
      console.log('[WebRTC] Call already initializing or active');
      return;
    }

    try {
      setIsInitializing(true);
      setError(null);
      console.log('[WebRTC] Starting call, isInitiator:', isInitiator);

      console.log('[WebRTC] Requesting user media...');
      const stream = await requestMicrophoneAccess();

      console.log('[WebRTC] Got local stream:', stream, 'tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));

      // Initialize peer connection
      const pc = initializePeerConnection();
      peerConnection.current = pc;

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        console.log('[WebRTC] Adding local track:', track.kind, track.enabled, track.readyState);
        pc.addTrack(track, stream);
      });

      if (isInitiator && !skipOffer) {
        // Create offer
        console.log('[WebRTC] Creating offer as initiator');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        await pc.setLocalDescription(offer);
        console.log('[WebRTC] Sending offer:', offer);
        await sendSignal('offer', offer);
      }

    } catch (error) {
      console.error('[WebRTC] Failed to start call:', error);
      cleanup();
    } finally {
      setIsInitializing(false);
    }
  }, [isInitiator, initializePeerConnection, sendSignal, cleanup, requestMicrophoneAccess, isInitializing]);

  const handleSignal = useCallback(async (signal) => {
    if (!peerConnection.current) {
      console.log('[WebRTC] No peer connection yet, starting before handling signal');
      await startCall({ skipOffer: true });
    }

    try {
      const pc = peerConnection.current;

      switch (signal.type) {
        case 'offer':
          console.log('[WebRTC] Received offer, creating answer');
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal('answer', answer);
          break;

        case 'answer':
          console.log('[WebRTC] Received answer, setting remote description');
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
          break;

        case 'ice-candidate':
          console.log('[WebRTC] Received ICE candidate:', signal.data);
          await pc.addIceCandidate(new RTCIceCandidate(signal.data));
          break;
      }
    } catch (error) {
      console.error('Failed to handle signal:', error);
      setError('Errore durante la negoziazione della chiamata');
    }
  }, [sendSignal, startCall]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted; // If currently muted, enable it
        setIsMuted(!isMuted);
        console.log('[WebRTC] Toggled mute:', !isMuted);
      }
    }
  }, [localStream, isMuted]);

  const endCall = useCallback(() => {
    cleanup();
    if (onCallEnd) {
      onCallEnd();
    }
  }, [cleanup, onCallEnd]);

  // Cleanup on unmount
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