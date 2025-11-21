import { useState, useEffect } from 'react';
import client from '../api/client.js';
import usePresence from '../hooks/usePresence.js';

export default function OnlineStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { onlineUsers } = usePresence();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await client.get('/presence/stats');
        setStats(res.data);
        setError('');
      } catch (err) {
        setError('Impossibile caricare le statistiche di presenza.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="online-stats-card">
        <h3>Utenti Online</h3>
        <div className="stats-loading">Caricamento...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="online-stats-card">
        <h3>Utenti Online</h3>
        <div className="stats-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="online-stats-card">
      <h3>Utenti Online</h3>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-number">{stats?.total_online || 0}</span>
          <span className="stat-label">Totale Online</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{stats?.online_masters || 0}</span>
          <span className="stat-label">Master Online</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{stats?.online_consumers || 0}</span>
          <span className="stat-label">Clienti Online</span>
        </div>
      </div>
      <div className="stats-realtime">
        <p className="micro">Aggiornamento in tempo reale: {onlineUsers.length} connessioni attive</p>
        <p className="micro">Ultimo aggiornamento: {new Date(stats?.last_updated).toLocaleTimeString('it-IT')}</p>
      </div>
    </div>
  );
}