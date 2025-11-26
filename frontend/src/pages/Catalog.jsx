import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import client from '../api/client.js';
import { summarizeWorkingHours, resolveTimezoneLabel } from '../utils/schedule.js';
import { resolveAvailabilityStatus } from '../utils/availability.js';
import FancySelect from '../components/FancySelect.jsx';
import SessionNotificationButton from '../components/SessionNotificationButton.jsx';
import OnlineIndicator from '../components/OnlineIndicator.jsx';
import Avatar from '../components/Avatar.jsx';
import useSocket from '../hooks/useSocket.js';
import usePresence from '../hooks/usePresence.js';

const categories = [
  { value: 'all', label: 'Tutte le categorie' },
  { value: 'cartomancy-divination', label: 'Cartomanzia e Divinazione' },
  { value: 'spirituality-intuition', label: 'Spiritualità e Intuizione' },
  { value: 'inner-wellness-life-coaching', label: 'Benessere interiore e Life Coaching' }
];

const sorts = [
  { value: 'rating', label: 'Miglior valutazione' },
  { value: 'priceAsc', label: 'Tariffa crescente' }
];

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [masters, setMasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const socket = useSocket();
  const { isUserOnline } = usePresence();

  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'rating';
  const availability = params.get('availability') || 'all';

  const loadCatalog = useCallback(async ({ showLoader = true } = {}) => {
    const query = { sort };
    if (category !== 'all') query.category = category;
    if (availability === 'online') query.online = true;

    if (showLoader) setLoading(true);
    setError('');
    try {
      const res = await client.get('/catalog', { params: query });
      setMasters(res.data);
    } catch (err) {
      setMasters([]);
      setError('Impossibile caricare il catalogo. Riprova più tardi.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [availability, category, sort]);

  useEffect(() => {
    loadCatalog();
    
    // Reload catalog after a short delay to get fresh presence data
    const presenceSync = setTimeout(() => {
      loadCatalog({ showLoader: false });
    }, 2000);
    
    return () => clearTimeout(presenceSync);
  }, [loadCatalog]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleSessionUpdate = () => loadCatalog({ showLoader: false });
    


    socket.on('voice:session:started', handleSessionUpdate);
    socket.on('voice:session:ended', handleSessionUpdate);
    socket.on('voice:session:expired', handleSessionUpdate);


    return () => {
      socket.off('voice:session:started', handleSessionUpdate);
      socket.off('voice:session:ended', handleSessionUpdate);
      socket.off('voice:session:expired', handleSessionUpdate);

    };
  }, [loadCatalog, socket]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value === 'all' || value === '' || value == null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const subtitle = useMemo(() => {
    const catLabel = categories.find(c => c.value === category)?.label || 'Tutte le categorie';
    const availLabel = availability === 'online' ? ' · Disponibili ora' : '';
    return `${catLabel}${availLabel}`;
  }, [category, availability]);

  return (
    <section className="container catalog">
      <div className="section-head">
        <span className="badge-soft">Catalogo</span>
        <h1>Trova il Esperti perfetto per te</h1>
        <p className="muted">{subtitle}</p>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label>Categoria</label>
          <div className="filter-pills">
            {categories.map(cat => (
              <button
                key={cat.value}
                type="button"
                className={`pill${category === cat.value ? ' active' : ''}`}
                onClick={() => setFilter('category', cat.value === 'all' ? null : cat.value)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <label>Disponibilità</label>
          <div className="filter-pills">
            <button
              type="button"
              className={`pill${availability === 'all' ? ' active' : ''}`}
              onClick={() => setFilter('availability', null)}
            >
              Tutti
            </button>
            <button
              type="button"
              className={`pill${availability === 'online' ? ' active' : ''}`}
              onClick={() => setFilter('availability', 'online')}
            >
              Online ora
            </button>
          </div>
        </div>
        <div className="filter-group select">
          <label htmlFor="sort">Ordina per</label>
          <FancySelect
            name="sort"
            value={sort}
            options={sorts}
            onChange={evt => setFilter('sort', evt.target.value)}
          />
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="master-grid">
        {loading && (
          <div className="skeleton-grid">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="skeleton-card" />
            ))}
          </div>
        )}

        {!loading && masters.length === 0 && !error && (
          <div className="empty-state">
            <h3>Nessun Esperti trovato</h3>
            <p className="muted">Modifica i filtri o prova a rimuovere la disponibilità immediata.</p>
          </div>
        )}

        {!loading && masters.length > 0 && (
          <div className="card-grid">
            {masters.map(master => {
              const rating = master.reviews?.avg_rating ? master.reviews.avg_rating.toFixed(1) : '—';
              const reviewCount = master.reviews?.count || 0;
              const scheduleSummary = summarizeWorkingHours(master.working_hours);
              const timezoneLabel = resolveTimezoneLabel(master.working_hours);
              const isReallyOnline = master.is_online || isUserOnline(master.user_id);
              const finalStatus = isReallyOnline ? 'online' : 'offline';
              const finalLabel = isReallyOnline ? 'Online' : 'Offline';
              const sessionChannelLabel = master.active_session_channel === 'voice'
                ? 'Voce'
                : master.active_session_channel === 'chat_voice'
                  ? 'Chat + Voce'
                  : 'Chat';
              const profilePath = master._id ? `/masters/${master._id}` : undefined;
              return (
                <article key={master._id} className="master-card">
                  <div className="master-media">
                    {profilePath ? (
                      <Link
                        to={profilePath}
                        className="master-avatar-link"
                        aria-label={`Apri il profilo di ${master.display_name || 'Esperti Rivelya'}`}
                      >
                        <Avatar
                          src={master.media?.avatar_url}
                          name={master.display_name || 'Esperti Rivelya'}
                          size="large"
                        />
                      </Link>
                    ) : (
                      <Avatar
                        src={master.media?.avatar_url}
                        name={master.display_name || 'Esperti Rivelya'}
                        size="large"
                      />
                    )}
                    <span className={`status-badge ${finalStatus}`}>{finalLabel}</span>
                  </div>
                  <div className="master-content">
                    <div className="master-header">
                      <div className="master-title">
                        {profilePath ? (
                          <Link to={profilePath} className="master-name-link">
                            <h3>{master.display_name || 'Esperti Rivelya'}</h3>
                          </Link>
                        ) : (
                          <h3>{master.display_name || 'Esperti Rivelya'}</h3>
                        )}
                        <OnlineIndicator
                          userId={master.user_id}
                          isOnline={master.is_online}
                          lastSeen={master.last_seen}
                          showLabel={false}
                        />
                        {master.active_session && (
                          <span className="live-indicator">
                            <span className="live-pulse" aria-hidden="true" />
                            In Sessione
                            </span>
                        )}
                        {master.active_session && (
                          <SessionNotificationButton 
                            masterId={master._id}
                            masterName={master.display_name}
                            isBusy={true}
                          />
                        )}
                      </div>
                      <div className="profile-rating">
                        <span className="rating-large">★ {rating}</span>
                      </div>
                    </div>
                    <p className="muted">{master.headline || master.bio || 'Professionista certificato del network Rivelya.'}</p>
                    <div className="tag-list">
                      {(master.categories || []).slice(0, 3).map(cat => (
                        <span key={cat} className="tag">{cat}</span>
                      ))}
                      {(master.languages || []).slice(0, 2).map(lang => (
                        <span key={lang} className="tag ghost">{lang}</span>
                      ))}
                    </div>
                    <div className="master-footer">
                      <div>
                        {master.services?.chat && (
                          <p className="price">Chat {(master.rate_chat_cpm / 100).toFixed(2)} €/min</p>
                        )}
                        {master.services?.voice && (
                          <p className="muted">Voce {(master.rate_voice_cpm / 100).toFixed(2)} €/min</p>
                        )}
                        {master.services?.chat_voice && (
                          <p className="muted">Chat e Voce {(master.rate_chat_voice_cpm / 100).toFixed(2)} €/min</p>
                        )}
                      </div>
                      <Link to={`/masters/${master._id}`} className="btn ghost">Dettagli</Link>
                    </div>
                    <p className="micro muted schedule-info">Orari: {scheduleSummary}{timezoneLabel ? ` · ${timezoneLabel}` : ''}</p>
                    <p className="micro">{master.experience_years ? `${master.experience_years}+ anni di esperienza · ` : ''}{reviewCount} recensioni · {(master.sessions?.voice || 0) + (master.sessions?.chat || 0)} sessioni</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
