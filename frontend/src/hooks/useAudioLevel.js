import { useEffect, useRef, useState } from 'react';

const DEFAULT_SMOOTHING = 0.12;

const clamp = value => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

/**
 * Returns a normalized audio level (0 - 1) for the provided MediaStream.
 * The hook uses a Web Audio analyser node to extract the amplitude in real time.
 */
export default function useAudioLevel(stream, { disabled = false, smoothing = DEFAULT_SMOOTHING } = {}) {
  const [level, setLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const rafRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!stream || disabled) {
      setLevel(0);
      return () => {};
    }

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(stream);
    sourceRef.current = source;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    dataArrayRef.current = dataArray;

    let raf;
    const updateLevel = () => {
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i += 1) {
        const value = dataArray[i] - 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const normalized = clamp(rms / 128);
      setLevel(prev => {
        const delta = normalized - prev;
        return clamp(prev + delta * (1 - smoothing));
      });
      raf = requestAnimationFrame(updateLevel);
      rafRef.current = raf;
    };

    if (audioContext.state === 'suspended') {
      audioContext.resume().then(updateLevel);
    } else {
      updateLevel();
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      audioContextRef.current?.close();
      dataArrayRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      audioContextRef.current = null;
      setLevel(0);
    };
  }, [stream, disabled, smoothing]);

  return level;
}
