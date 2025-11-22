import { useEffect, useState, useRef } from 'react';

const computeSeconds = expiresAt => {
  if (!expiresAt) return null;
  const target = typeof expiresAt === 'string' || expiresAt instanceof String ? new Date(expiresAt) : expiresAt;
  if (!target || Number.isNaN(target.getTime())) return null;
  const diff = Math.floor((target.getTime() - Date.now()) / 1000);
  return diff > 0 ? diff : 0;
};

export default function useCountdown(expiresAt) {
  const [seconds, setSeconds] = useState(() => computeSeconds(expiresAt));
  const intervalRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    const newSeconds = computeSeconds(expiresAt);
    setSeconds(newSeconds);
    lastUpdateRef.current = Date.now();
  }, [expiresAt]);

  useEffect(() => {
    if (seconds == null) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Recalculate from expiresAt every 5 seconds to prevent drift
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateRef.current;
      
      // If more than 5 seconds have passed, recalculate from source
      if (timeSinceLastUpdate >= 5000) {
        const accurate = computeSeconds(expiresAt);
        setSeconds(accurate);
        lastUpdateRef.current = now;
      } else {
        // Otherwise just decrement
        setSeconds(prev => {
          if (prev == null) return prev;
          return prev > 0 ? prev - 1 : 0;
        });
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [seconds == null, expiresAt]);

  return seconds;
}
