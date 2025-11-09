import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import client from '../api/client.js';

export default function MasterProfile() {
  const { id } = useParams();
  const [master, setMaster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    client.get(`/catalog/${id}`)
      .then(res => {
        setMaster(res.data);
      })
      .catch(() => {
        setMaster(null);
        setError('Master non trovato o non disponibile.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const ensureAuth = () => {
    if (!localStorage.getItem('token')) {
      toast.error('Effettua il login per avviare una sessione.');
      return false;
    }
    return true;
  };

  const startSession = async channel => {
    if (!master || !ensureAuth()) return;
    try {
      const endpoint = channel === 'phone' ? '/session/phone' : '/session/chat';
      const res = await client.post(endpoint, { master_id: master._id });
      if (channel === 'phone') {
        toast.success('Sessione telefonica creata. Ti richiamiamo a breve.');
      } else {
        toast.success('Chat avviata. Ti reindirizziamo alla stanza.');
        if (res.data.ws_url) {
          window.open(res.data.ws_url, '_blank', 'noopener');
        }
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Impossibile avviare la sessione in questo momento.';
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <section className="container profile">
        <div className="profile-card skeleton" />
      </section>
    );
  }

  if (error || !master) {
    return (
      <section className="container profile">
        <div className="alert">{error || 'Master non disponibile.'}</div>
      </section>
    );
  }

  const ratingValue = master.kpis?.avg_rating;
  const rating = typeof ratingValue === 'number' ? ratingValue.toFixed(1) : '—';

  return (
    <section className="container profile">
      <div className="profile-card">
        <div className="profile-avatar">
          <img src={master.media?.avatar_url || 'https://placehold.co/320'} alt={master.display_name || 'Master Rivelya'} />
          <span className={`status-badge ${master.availability}`}>{master.availability}</span>
        </div>
        <div className="profile-content">
          <span className="badge-soft">Master {master.categories?.[0] || 'Rivelya'}</span>
          <h1>{master.display_name || 'Master Rivelya'}</h1>
          <p className="muted">{master.headline || 'Professionista certificato del network Rivelya.'}</p>
          <div className="profile-rating">
            <span className="rating-large">★ {rating}</span>
            <span className="muted">{master.kpis?.review_count || 0} recensioni · {master.experience_years || '5'} anni di esperienza</span>
          </div>
          <p>{master.bio || 'Questo master è disponibile per consulenze su richiesta con un approccio empatico e orientato ai risultati.'}</p>
          <div className="tag-list">
            {(master.specialties || master.categories || []).slice(0, 4).map(spec => (
              <span key={spec} className="tag">{spec}</span>
            ))}
            {(master.languages || []).map(lang => (
              <span key={lang} className="tag ghost">{lang}</span>
            ))}
          </div>
          <div className="profile-stats">
            <div>
              <span className="stat-value">{master.kpis?.lifetime_calls || 0}</span>
              <span className="stat-label">Chiamate</span>
            </div>
            <div>
              <span className="stat-value">{master.kpis?.lifetime_chats || 0}</span>
              <span className="stat-label">Chat</span>
            </div>
            <div>
              <span className="stat-value">{master.kpis?.review_count || 0}</span>
              <span className="stat-label">Recensioni</span>
            </div>
          </div>
        </div>
      </div>
      <div className="profile-actions">
        <div className="rate-card">
          <p>Tariffa telefonica</p>
          <h3>{(master.rate_phone_cpm / 100).toFixed(2)} € / min</h3>
          <p className="muted">Prima chiamata gratuita fino a 5 minuti per i nuovi clienti.</p>
          <button className="btn primary" onClick={() => startSession('phone')}>Avvia chiamata</button>
        </div>
        <div className="rate-card">
          <p>Tariffa chat</p>
          <h3>{(master.rate_chat_cpm / 100).toFixed(2)} € / min</h3>
          <p className="muted">Risposte asincrone e follow-up via report dedicato.</p>
          <button className="btn outline" onClick={() => startSession('chat')}>Apri chat</button>
        </div>
      </div>
    </section>
  );
}
