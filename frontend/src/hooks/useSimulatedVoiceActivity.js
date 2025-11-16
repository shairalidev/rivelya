import { useEffect, useRef, useState } from 'react';

const clamp = value => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

export default function useSimulatedVoiceActivity(isActive) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      setLevel(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return () => {};
    }

    let nextTarget = Math.random() * 0.85 + 0.1;
    let frame;

    const tick = () => {
      setLevel(prev => {
        const target = nextTarget;
        const eased = prev + (target - prev) * 0.08;
        const safe = clamp(eased);
        if (Math.abs(safe - target) < 0.02) {
          nextTarget = Math.random() * 0.85 + 0.05;
        }
        return safe;
      });
      frame = requestAnimationFrame(tick);
      rafRef.current = frame;
    };

    frame = requestAnimationFrame(tick);
    rafRef.current = frame;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isActive]);

  return level;
}
