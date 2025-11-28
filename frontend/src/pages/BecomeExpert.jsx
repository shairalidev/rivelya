import { Link } from 'react-router-dom';

const requirements = [
  'avere esperienza comprovabile nel proprio settore',
  'essere in grado di sostenere sessioni professionali e rispettose',
  'possedere etica, empatia e capacit&agrave; di guida',
  "comprendere l'importanza della privacy e della responsabilit&agrave;",
  'fornire, se richiesto, prove del proprio percorso professionale'
];

const offers = [
  'visibilit&agrave; costante',
  'sistema di prenotazione e chiamate integrato',
  'pagamenti sicuri',
  'supporto continuo',
  'onboarding professionale',
  'una community di esperti seri e certificati'
];

export default function BecomeExpert() {
  return (
    <div className="become-expert-page">
      <section className="container section">
        <div className="section-head">
          <span className="badge-soft">Opportunit&agrave; Esperti</span>
          <h1>Diventa un Esperto su Rivelya</h1>
          <p className="lead">
            Entrare qui non &egrave; un diritto. &Egrave; un riconoscimento.
          </p>
        </div>
        <div className="become-expert-intro">
          <p>
            Rivelya seleziona con grande cura i propri esperti. Cerchiamo professionisti reali: persone che hanno esperienza autentica, formazione verificabile e una sensibilit&agrave; tale da accompagnare gli utenti con seriet&agrave;, rispetto ed etica.
          </p>
          <p>
            La nostra piattaforma accoglie solo chi pu&ograve; dimostrare competenza, integrit&agrave; e un percorso professionale solido nei propri ambiti (cartomanzia, spiritualit&agrave;, energie, benessere interiore).
          </p>
          <p className="muted">
            Non cerchiamo chi &ldquo;vuole provare&rdquo;. Cerchiamo chi gi&agrave; lo &egrave;.
          </p>
        </div>

        <div className="become-expert-grid">
          <article className="become-expert-card">
            <div className="become-expert-heading">
              <span className="experience-icon" aria-hidden="true">&#x2728;</span>
              <div>
                <h3>Cosa richiediamo</h3>
                <p className="muted">Per essere considerato, un esperto deve:</p>
              </div>
            </div>
            <ul className="become-expert-list">
              {requirements.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="become-expert-card">
            <div className="become-expert-heading">
              <span className="experience-icon" aria-hidden="true">&#x1F33F;</span>
              <div>
                <h3>Cosa offriamo</h3>
                <p className="muted">Entrare in Rivelya significa far parte di una rete selezionata di professionisti, con:</p>
              </div>
            </div>
            <ul className="become-expert-list">
              {offers.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>

        <article className="become-expert-cta">
          <div className="become-expert-heading">
            <span className="experience-icon" aria-hidden="true">&#x1F52E;</span>
            <div>
              <h3>Come candidarsi</h3>
              <p>Compila il modulo di candidatura e ti ricontatteremo per il processo di onboarding.</p>
            </div>
          </div>
          <p className="muted">
            Se possiedi tutti i requisiti sopra elencati, puoi compilare il modulo di candidatura. Ogni profilo viene valutato con attenzione. Se ritenuto idoneo, sarai ricontattato per il processo di onboarding.
          </p>
          <Link to="/support" className="link">
            &rarr; Compila la candidatura
          </Link>
        </article>
      </section>
    </div>
  );
}
