import { useEffect, useState } from 'react';

export default function useSimulatedVoiceActivity(isActive) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setLevel(0);
      return;
    }

    const interval = setInterval(() => {
      // Simulate realistic voice activity patterns
      const random = Math.random();
      
      if (random < 0.3) {
        // 30% chance of silence
        setLevel(0);
      } else if (random < 0.7) {
        // 40% chance of moderate activity
        setLevel(0.2 + Math.random() * 0.4);
      } else {
        // 30% chance of high activity
        setLevel(0.6 + Math.random() * 0.4);
      }
    }, 150 + Math.random() * 100); // Vary timing slightly

    return () => clearInterval(interval);
  }, [isActive]);

  return level;
}