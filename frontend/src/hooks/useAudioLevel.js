import { useEffect, useState, useRef } from 'react';

export default function useAudioLevel(stream, options = {}) {
  const [level, setLevel] = useState(0);
  const analyzerRef = useRef(null);
  const animationRef = useRef(null);
  const { disabled = false } = options;

  useEffect(() => {
    if (!stream || disabled) {
      setLevel(0);
      return;
    }

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyzer = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.8;
      source.connect(analyzer);
      
      analyzerRef.current = analyzer;
      
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      
      const updateLevel = () => {
        if (!analyzerRef.current) return;
        
        analyzer.getByteFrequencyData(dataArray);
        
        // Calculate RMS (Root Mean Square) for more accurate volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const normalizedLevel = Math.min(rms / 128, 1); // Normalize to 0-1
        
        setLevel(normalizedLevel);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        if (audioContext.state !== 'closed') {
          audioContext.close();
        }
        analyzerRef.current = null;
      };
    } catch (error) {
      console.warn('Audio level monitoring not supported:', error);
      setLevel(0);
    }
  }, [stream, disabled]);

  return level;
}