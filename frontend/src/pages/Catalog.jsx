import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import client from '../api/client.js';
import { summarizeWorkingHours, resolveTimezoneLabel } from '../utils/schedule.js';
import { resolveAvailabilityStatus } from '../utils/availability.js';
import FancySelect from '../components/FancySelect.jsx';

const categories = [
  { value: 'all', label: 'Tutte le categorie' },
  { value: 'cartomancy-divination', label: 'Cartomancy & Divination' },
  { value: 'spirituality-intuition', label: 'Spirituality & Intuition' },
  { value: 'inner-wellness-life-coaching', label: 'Inner Wellness & Life Coaching' }
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

  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'rating';
  const availability = params.get('availability') || 'all';

  useEffect(() => {
    const query = { sort };
    if (category !== 'all') query.category = category;
    if (availability === 'online') query.online = true;

    setLoading(true);
    setError('');
    client.get('/catalog', { params: query })
      .then(res => setMasters(res.data))
      .catch(() => {
        setMasters([]);
        setError('Impossibile caricare il catalogo. Riprova più tardi.');
      })
      .finally(() => setLoading(false));
  }, [category, sort, availability]);

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
              const ratingValue = master.kpis?.avg_rating;
              const rating = typeof ratingValue === 'number' ? ratingValue.toFixed(1) : '—';
              const scheduleSummary = summarizeWorkingHours(master.working_hours);
              const timezoneLabel = resolveTimezoneLabel(master.working_hours);
              const { status: availabilityStatus, label: availabilityLabel } = resolveAvailabilityStatus(master.availability);
              return (
                <article key={master._id} className="master-card">
                  <div className="master-media">
                    <img src={master.media?.avatar_url || 'https://placehold.co/240x240'} alt="" />
                    <span className={`status-badge ${availabilityStatus}`}>{availabilityLabel}</span>
                  </div>
                  <div className="master-content">
                    <div className="master-header">
                      <h3>{master.display_name || 'Master Rivelya'}</h3>
                      <span className="rating">★ {rating}</span>
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
                    <p className="micro">{master.experience_years ? `${master.experience_years}+ anni di esperienza · ` : ''}{master.kpis?.review_count || 0} recensioni</p>
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
