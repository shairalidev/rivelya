import { useState, useRef } from 'react';

export default function MicTest() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);
  const audioRef = useRef(null);

  const startTest = async () => {
    try {
      setError(null);
      console.log('[MicTest] Starting microphone test...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('[MicTest] Got media stream:', mediaStream);
      console.log('[MicTest] Audio tracks:', mediaStream.getAudioTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        label: t.label
      })));
      
      setStream(mediaStream);
      setIsRecording(true);
      
      if (audioRef.current) {
        audioRef.current.srcObject = mediaStream;
        audioRef.current.muted = false; // Allow hearing own voice for test
      }
      
    } catch (err) {
      console.error('[MicTest] Error accessing microphone:', err);
      setError(`Errore microfono: ${err.name} - ${err.message}`);
    }
  };

  const stopTest = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log('[MicTest] Stopping track:', track.kind);
        track.stop();
      });
      setStream(null);
    }
    setIsRecording(false);
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      padding: '10px', 
      border: '1px solid #ccc',
      borderRadius: '5px',
      zIndex: 9999,
      minWidth: '200px'
    }}>
      <h4>Mic Test</h4>
      <audio ref={audioRef} autoPlay playsInline />
      
      {!isRecording ? (
        <button onClick={startTest} style={{ marginRight: '5px' }}>
          Test Mic
        </button>
      ) : (
        <button onClick={stopTest} style={{ marginRight: '5px' }}>
          Stop Test
        </button>
      )}
      
      <div style={{ fontSize: '12px', marginTop: '5px' }}>
        Status: {isRecording ? '🔴 Recording' : '⚫ Stopped'}
      </div>
      
      {error && (
        <div style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>
          {error}
        </div>
      )}
      
      {stream && (
        <div style={{ fontSize: '11px', marginTop: '5px', color: 'green' }}>
          ✓ Tracks: {stream.getAudioTracks().length}
        </div>
      )}
    </div>
  );
}