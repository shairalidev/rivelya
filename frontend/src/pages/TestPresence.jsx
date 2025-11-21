import { useState, useEffect } from 'react';
import client from '../api/client.js';
import usePresence from '../hooks/usePresence.js';
import OnlineIndicator from '../components/OnlineIndicator.jsx';
import OnlineStats from '../components/OnlineStats.jsx';

export default function TestPresence() {
  const [onlineMasters, setOnlineMasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const { onlineUsers, isUserOnline } = usePresence();

  useEffect(() => {
    const fetchOnlineMasters = async () => {
      try {
        const res = await client.get('/presence/online-masters');
        setOnlineMasters(res.data);
      } catch (error) {
        console.error('Error fetching online masters:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOnlineMasters();
    const interval = setInterval(fetchOnlineMasters, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="container">
      <div className="section-head">
        <span className="badge-soft">Test Presenza</span>
        <h1>Sistema di Presenza in Tempo Reale</h1>
        <p className="muted">Test del sistema di tracking della presenza online degli utenti.</p>
      </div>

      <div className="grid-two">
        <OnlineStats />
        
        <div className="info-card">
          <h3>Connessioni WebSocket Attive</h3>
          <p>Utenti connessi tramite WebSocket: <strong>{onlineUsers.length}</strong></p>
          <div className="online-users-list">
            {onlineUsers.map(user => (
              <div key={user.userId} className="online-user-item">
                <OnlineIndicator 
                  userId={user.userId}
                  isOnline={user.isOnline}
                  lastSeen={user.lastSeen}
                />
                <span>ID: {user.userId}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="info-card">
        <h3>Master Online</h3>
        {loading ? (
          <p>Caricamento...</p>
        ) : onlineMasters.length === 0 ? (
          <p className="muted">Nessun master online al momento.</p>
        ) : (
          <div className="master-grid">
            {onlineMasters.map(master => (
              <div key={master._id} className="master-online-card">
                <img 
                  src={master.avatar_url || 'https://placehold.co/60x60'} 
                  alt={master.display_name}
                  width="60"
                  height="60"
                />
                <div>
                  <h4>{master.display_name}</h4>
                  <OnlineIndicator 
                    userId={master.user_id}
                    isOnline={master.is_online}
                    lastSeen={master.last_seen}
                  />
                  <p className="micro">Categorie: {master.categories?.join(', ') || 'N/A'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}