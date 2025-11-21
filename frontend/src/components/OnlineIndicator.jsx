import { useMemo } from 'react';
import usePresence from '../hooks/usePresence.js';

export default function OnlineIndicator({ userId, isOnline: propIsOnline, lastSeen: propLastSeen, showLabel = true }) {
  const { isUserOnline, getUserLastSeen } = usePresence();
  
  const isOnline = propIsOnline !== undefined ? propIsOnline : isUserOnline(userId);
  const lastSeen = propLastSeen !== undefined ? propLastSeen : getUserLastSeen(userId);
  
  const timeAgo = useMemo(() => {
    if (!lastSeen) return null;
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Ora';
    if (diffMins < 60) return `${diffMins}m fa`;
    if (diffHours < 24) return `${diffHours}h fa`;
    if (diffDays < 7) return `${diffDays}g fa`;
    return lastSeenDate.toLocaleDateString('it-IT');
  }, [lastSeen]);
  
  if (isOnline) {
    return (
      <span className="online-indicator online">
        <span className="online-dot" />
        {showLabel && 'Online'}
      </span>
    );
  }
  
  if (timeAgo && showLabel) {
    return (
      <span className="online-indicator offline">
        <span className="offline-dot" />
        Visto {timeAgo}
      </span>
    );
  }
  
  return (
    <span className="online-indicator offline">
      <span className="offline-dot" />
      {showLabel && 'Offline'}
    </span>
  );
}