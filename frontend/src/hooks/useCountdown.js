import { useEffect, useState } from 'react';

const computeSeconds = expiresAt => {
  if (!expiresAt) return null;
  const target = typeof expiresAt === 'string' || expiresAt instanceof String ? new Date(expiresAt) : expiresAt;
  if (!target || Number.isNaN(target.getTime())) return null;
  const diff = Math.floor((target.getTime() - Date.now()) / 1000);
  return diff > 0 ? diff : 0;
};

export default function useCountdown(expiresAt) {
  const [seconds, setSeconds] = useState(() => computeSeconds(expiresAt));

  useEffect(() => {
    setSeconds(computeSeconds(expiresAt));
  }, [expiresAt]);

  useEffect(() => {
    if (seconds == null) return undefined;
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev == null) return prev;
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [seconds == null]);

  return seconds;
}
