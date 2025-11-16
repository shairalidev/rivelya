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
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal('ice-candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = stream;
      }
    };

    pc.onconnectionstatechange = () => {
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
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      setLocalStream(stream);
      
      if (localAudio.current) {
        localAudio.current.srcObject = stream;
      }

      // Initialize peer connection
      const pc = initializePeerConnection();
      peerConnection.current = pc;

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      if (isInitiator) {
        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal('offer', offer);
      }

    } catch (error) {
      console.error('Failed to start call:', error);
      setError('Impossibile accedere al microfono');
      cleanup();
    }
  }, [isInitiator, initializePeerConnection, sendSignal, cleanup]);

  const handleSignal = useCallback(async (signal) => {
    if (!peerConnection.current) return;

    try {
      const pc = peerConnection.current;

      switch (signal.type) {
        case 'offer':
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal('answer', answer);
          break;

        case 'answer':
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
          break;

        case 'ice-candidate':
          await pc.addIceCandidate(new RTCIceCandidate(signal.data));
          break;
      }
    } catch (error) {
      console.error('Failed to handle signal:', error);
      setError('Errore durante la negoziazione della chiamata');
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