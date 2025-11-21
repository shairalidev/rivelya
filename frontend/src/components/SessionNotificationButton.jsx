import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { subscribeToSessionEnd, unsubscribeFromSessionEnd, getSubscriptionStatus } from '../api/session-notifications.js';
import { getToken } from '../lib/auth.js';

const BellIcon = ({ filled = false, ...props }) => (
  <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export default function SessionNotificationButton({ masterId, masterName, isBusy }) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  
  console.log('SessionNotificationButton props:', { masterId, masterName, isBusy });

  useEffect(() => {
    if (!masterId || !getToken()) {
      setCheckingStatus(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const { subscribed: isSubscribed } = await getSubscriptionStatus(masterId);
        setSubscribed(isSubscribed);
      } catch (error) {
        console.error('Error checking subscription status:', error);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkStatus();
  }, [masterId]);

  const handleToggleNotification = async () => {
    if (!getToken()) {
      toast.error('Effettua il login per ricevere notifiche.');
      return;
    }

    if (subscribed) {
      return; // Prevent multiple requests when already subscribed
    }

    setLoading(true);
    try {
      await subscribeToSessionEnd(masterId);
      setSubscribed(true);
      toast.success('Ti avviseremo quando sarà disponibile!');
    } catch (error) {
      const message = error?.response?.data?.message || 'Errore durante l\'operazione';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Don't show the button if expert is not busy or if we're still checking status
  console.log('Button visibility check:', { isBusy, checkingStatus, shouldShow: isBusy && !checkingStatus });
  if (!isBusy || checkingStatus) {
    return null;
  }

  return (
    <button
      onClick={handleToggleNotification}
      disabled={loading || subscribed}
      className={`notification-btn ${subscribed ? 'active' : ''}`}
      title={subscribed ? 'Notifiche attive' : 'Avvisami quando è disponibile'}
    >
      <BellIcon filled={subscribed} size={16} />
      {subscribed ? 'Notifiche attive' : 'Avvisami'}
    </button>
  );
}