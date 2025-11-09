import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';

const stats = [
  { label: 'Master certificati', value: '120+' },
  { label: 'Tempo medio di risposta', value: '45s' },
  { label: 'Valutazione media', value: '4.9/5' }
];

const pillars = [
  {
    title: 'Cartomanzia & spiritualità',
    description: 'Tarocchi evolutivi, astrologia e rituali energetici condotti da professionisti con percorsi certificati.',
    icon: '🔮'
  },
  {
    title: 'Consulenza legale immediata',
    description: 'Avvocati e fiscalisti per supporto rapido su tutela familiare, contratti e gestione aziendale.',
    icon: '⚖️'
  },
  {
    title: 'Coaching & benessere',
    description: 'Mindset coach, psicologi e mentori per performance, gestione dello stress e benessere mentale.',
    icon: '🌿'
  }
];

const steps = [
  { title: 'Scegli il master', description: 'Filtra per categoria, lingua e disponibilità in tempo reale.' },
  { title: 'Prenota in 1 click', description: 'Attiva sessioni telefoniche o chat con tariffa chiara al minuto.' },
  { title: 'Ricevi report e follow-up', description: 'Ritrova note, registri e consigli nella tua area personale.' }
];

const testimonials = [
  {
    quote: 'La nostra customer care ha ridotto del 30% i tempi di risposta ai clienti premium grazie alla rete di master Rivelya.',
    author: 'Francesca B., Customer Experience Lead'
  },
  {
    quote: 'Consulenti affidabili e onboarding impeccabile. Le ricariche istantanee hanno migliorato la nostra retention.',
    author: 'Luca R., Founder studio legale digitale'
  }
];

export default function Home() {
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    client.get('/catalog', { params: { sort: 'rating' } })
      .then(res => setFeatured(res.data.slice(0, 3)))
      .catch(() => setFeatured([]));
  }, []);

  return (
    <div className="home">
      <section className="hero container">
        <div className="hero-copy">
          <span className="badge-soft">Rivelya Platform</span>
          <h1>Consulenze professionali on-demand, senza attese.</h1>
          <p className="lead">
            Attiva in pochi secondi una sessione con cartomanti, avvocati e coach certificati. Ricariche smart, report automatici e supporto 24/7.
          </p>
          <div className="hero-actions">
            <Link to="/catalog" className="btn primary">Esplora i master</Link>
            <Link to="/register" className="btn outline">Attiva account</Link>
          </div>
          <div className="hero-stats">
            {stats.map(stat => (
              <div key={stat.label} className="stat-card">
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card">
            <p className="muted">Top rated</p>
            <ul>
              {featured.map(master => (
                <li key={master._id} className="hero-master">
                  <img src={master.media?.avatar_url || 'https://placehold.co/64'} alt="" />
                  <div>
                    <p className="hero-master-name">{master.display_name || 'Master Rivelya'}</p>
                    <p className="hero-master-meta">
                      Rating {typeof master.kpis?.avg_rating === 'number' ? master.kpis.avg_rating.toFixed(1) : '—'} · {(master.categories || []).join(' · ')}
                    </p>
                  </div>
                  <Link to={`/masters/${master._id}`} className="btn ghost">Apri</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="esperienza" className="container section-grid">
        {pillars.map(pillar => (
          <article key={pillar.title} className="info-card">
            <span className="info-icon">{pillar.icon}</span>
            <h3>{pillar.title}</h3>
            <p className="muted">{pillar.description}</p>
            <Link to="/catalog" className="link">Scopri gli specialisti →</Link>
          </article>
        ))}
      </section>

      <section className="container section" id="business">
        <div className="section-head">
          <span className="badge-soft">Per aziende</span>
          <h2>Soluzione enterprise con SLA dedicati</h2>
          <p className="muted">Integra i master Rivelya nel tuo servizio clienti o offri benefit esclusivi al tuo team con wallet condivisi e fatturazione centralizzata.</p>
        </div>
        <div className="grid-two">
          {steps.map(step => (
            <div key={step.title} className="step-card">
              <h3>{step.title}</h3>
              <p className="muted">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section" id="supporto">
        <div className="section-head">
          <span className="badge-soft">Stories</span>
          <h2>Aziende e professionisti che hanno scelto Rivelya</h2>
        </div>
        <div className="testimonials">
          {testimonials.map(item => (
            <blockquote key={item.author} className="testimonial">
              <p>“{item.quote}”</p>
              <footer>— {item.author}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="container cta">
        <div className="cta-copy">
          <h2>Pronto a offrire consulenze premium ai tuoi utenti?</h2>
          <p className="muted">Crea un account e prova gratuitamente 5 minuti con i master certificati Rivelya.</p>
        </div>
        <div className="cta-actions">
          <Link to="/register" className="btn primary">Crea account</Link>
          <Link to="/catalog" className="btn ghost">Consulta il catalogo</Link>
        </div>
      </section>
    </div>
  );
}
