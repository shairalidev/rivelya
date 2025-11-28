import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { getUser as getStoredUser, subscribeAuthChange } from '../lib/auth.js';

const stats = [
  { label: 'Esperti certificati', value: '120+' },
  { label: 'Tempo medio di risposta', value: '45s' },
  { label: 'Valutazione media', value: '4.9/5' }
];

const pillars = [
  {
    title: 'Cartomanzia e Divinazione',
    description: 'Tarocchi, sibille, oracoli, rune e pendolo per risposte chiare guidate dai migliori cartomanti.',
    icon: '🔮'
  },
  {
    title: 'Spiritualità e Intuizione',
    description: "Channeling, letture energetiche, numerologia, missione dell'anima e interpretazione dei sogni per una guida autentica.",
    icon: '✨'
  },
  {
    title: 'Benessere interiore e Life Coaching',
    description: 'Percorsi di riequilibrio, mindfulness, gestione emotiva e legge di attrazione con coach certificati.',
    icon: '🧘'
  }
];

const steps = [
  { title: "Scegli l'esperto giusto", description: 'Filtra per categoria, lingua e disponibilità in tempo reale.' },
  { title: 'Prenota in 1 click', description: 'Attiva sessioni telefoniche o chat con tariffa chiara al minuto.' },
  { title: 'Ricevi report e follow-up', description: 'Ritrova note, registri e consigli nella tua area personale.' }
];

const experiencesHighlights = [
  {
    title: 'Chiarezza',
    icon: '?',
    description: 'Quando la mente si confonde e senti il bisogno di una risposta nitida, di un segno o di una direzione. Le nostre guide ti accompagnano a vedere ciò che già esiste dentro di te.'
  },
  {
    title: 'Connessione',
    icon: '??',
    description: 'Un?esperienza che ti avvicina ai tuoi simboli interiori, alla tua intuizione profonda, al linguaggio dell?energia che ti circonda.'
  },
  {
    title: 'Riequilibrio',
    icon: '??',
    description: 'Per ritrovare calma, respiro, centratura e leggerezza quando il mondo esterno pesa troppo e hai bisogno di rimetterti al centro.'
  },
  {
    title: 'Trasformazione',
    icon: '??',
    description: 'Un percorso che scioglie e libera: emozioni bloccate, cicli ripetuti, nodi interiori che aspettano solo di essere ascoltati e superati.'
  },
  {
    title: 'Allineamento',
    icon: '??',
    description: 'Quando senti che qualcosa sta cambiando in te e sei pronta a fare un passo avanti, con la guida di chi puo? aiutarti a leggere le tue energie.'
  }
];

const testimonials = [
  {
    quote: 'La nostra customer care ha ridotto del 30% i tempi di risposta ai clienti premium grazie alla rete di Esperti Rivelya.',
    author: 'Francesca B., Customer Experience Lead'
  },
  {
    quote: 'Consulenti affidabili e onboarding impeccabile. Le ricariche istantanee hanno migliorato la nostra retention.',
    author: 'Luca R., Founder community olistica digitale'
  }
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    client.get('/catalog', { params: { sort: 'rating' } })
      .then(res => setFeatured(res.data.slice(0, 3)))
      .catch(() => setFeatured([]));
  }, []);

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    const unsubscribe = subscribeAuthChange(sync);
    return () => unsubscribe();
  }, []);

  return (
    <div className="home">
      <section className="hero container">
        <div className="hero-copy">
          <span className="badge-soft">Rivelya Platform</span>
          <h1>Consulenze professionali on-demand, senza attese.</h1>
          <p className="lead">
            Attiva in pochi secondi una sessione con cartomanti, guide spirituali e coach del benessere certificati. Ricariche smart, report automatici e supporto 24/7.
          </p>
          <div className="hero-actions">
            <Link to="/catalog" className="btn primary">Esplora gli Esperti</Link>
            {!user && <Link to="/register" className="btn outline">Attiva account</Link>}
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
            <p className="muted">Esperti più apprezzati</p>
            <ul>
              {featured.map(master => (
                <li key={master._id} className="hero-master">
                  <img src={master.media?.avatar_url || 'https://placehold.co/64'} alt="" />
                  <div>
                    <p className="hero-master-name">{master.display_name || 'Esperti Rivelya'}</p>
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
            <Link to="/catalog" className="link">Scopri gli specialisti</Link>
          </article>
        ))}
      </section>

      
    </div>
  );
}
