import { useState } from 'react';
import client from '../api/client.js';

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

const fieldOptions = [
  'Cartomanzia',
  'Tarologia',
  'Astrologia',
  'Benessere interiore',
  'Spiritualit&agrave;',
  'Energie',
  'Coaching emotivo',
  'Altro'
];

const initialForm = {
  name: '',
  email: '',
  phone: '',
  domain: '',
  description: '',
  links: '',
  consent: false,
  marketingConsent: false
};

export default function BecomeExpert() {
  const [form, setForm] = useState(initialForm);
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openForm = () => {
    setFormOpen(true);
    setSubmitted(false);
    setFormError('');
  };

  const closeForm = () => {
    setFormOpen(false);
    setForm(initialForm);
    setSubmitted(false);
    setFormError('');
  };

  const handleChange = event => {
    const { name, value, type, checked } = event.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.domain || !form.description || !form.consent) {
      setFormError('Compila tutti i campi obbligatori e accetta il consenso privacy.');
      return;
    }

    setFormError('');
    setSubmitting(true);

    const formData = new FormData();
    formData.append('target', 'esperto');
    formData.append('name', form.name);
    formData.append('email', form.email);
    formData.append('issueType', 'Candidatura Esperto');
    formData.append(
      'description',
      `${form.description}\nAmbito: ${form.domain}\nTelefono: ${form.phone}\nLink: ${form.links || 'Nessuno'}`
    );
    formData.append('consent', form.consent ? 'on' : 'off');
    formData.append('marketingConsent', form.marketingConsent ? 'on' : 'off');
    formData.append('metadata', JSON.stringify({
      phone: form.phone,
      domain: form.domain,
      links: form.links,
      marketingConsent: form.marketingConsent
    }));

    try {
      await client.post('/support', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSubmitted(true);
    } catch (error) {
      setFormError('Si &egrave; verificato un errore durante l\'invio. Riprova pi&ugrave; tardi.');
    } finally {
      setSubmitting(false);
    }
  };

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
          <button type="button" className="btn primary become-expert-cta-trigger" onClick={openForm}>
            Invia candidatura
          </button>
          {formOpen && (
            <section className="become-expert-form-panel">
              <article className="become-expert-form-card">
                  <div className="become-expert-form-card-head">
                  <div className="become-expert-form-header">
                    <h2>Modulo di candidatura</h2>
                    <button type="button" className="btn ghost small" onClick={closeForm}>
                      Chiudi modulo
                    </button>
                  </div>
                  <p className="muted">
                    Completa il modulo qui sotto: il nostro team valuter&agrave; la tua candidatura e ti risponder&agrave; entro 24/48 ore.
                  </p>
                </div>
                {submitted ? (
                  <div className="become-expert-form-success">
                    <h3>Grazie!</h3>
                    <p>
                      Grazie. La tua candidatura &egrave; stata inviata. Il nostro team ti contatter&agrave; via email o telefono se il tuo profilo sar&agrave; ritenuto idoneo.
                    </p>
                    <button type="button" className="btn outline" onClick={closeForm}>
                      Chiudi modulo
                    </button>
                  </div>
                ) : (
                  <form className="become-expert-form" onSubmit={handleSubmit}>
                    <div className="become-expert-form-row">
                      <div className="become-expert-form-group">
                        <label htmlFor="name">Nome e cognome *</label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          value={form.name}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="become-expert-form-group">
                        <label htmlFor="email">Email *</label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          value={form.email}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="become-expert-form-row">
                      <div className="become-expert-form-group">
                        <label htmlFor="phone">Numero di telefono *</label>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={form.phone}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="become-expert-form-group">
                        <label htmlFor="domain">In quale ambito lavori? *</label>
                        <select id="domain" name="domain" value={form.domain} onChange={handleChange} required>
                          <option value="">Seleziona</option>
                          {fieldOptions.map(option => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="become-expert-form-group">
                      <label htmlFor="description">
                        Breve descrizione della tua esperienza (max 3-4 righe) *
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        rows="3"
                        value={form.description}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="become-expert-form-group">
                      <label htmlFor="links">Link ai tuoi profili o materiali (opzionale)</label>
                      <input
                        id="links"
                        name="links"
                        type="url"
                        value={form.links}
                        onChange={handleChange}
                        placeholder="Instagram, sito web, YouTube."
                      />
                    </div>
                    <div className="become-expert-form-group checkbox">
                      <label>
                        <input
                          name="consent"
                          type="checkbox"
                          checked={form.consent}
                          onChange={handleChange}
                          required
                        />
                        Autorizzo il trattamento dei dati personali ai sensi del GDPR.
                      </label>
                    </div>
                    <div className="become-expert-form-group checkbox">
                      <label>
                        <input
                          name="marketingConsent"
                          type="checkbox"
                          checked={form.marketingConsent}
                          onChange={handleChange}
                        />
                        Desidero ricevere aggiornamenti e comunicazioni promozionali da Rivelya (opzionale).
                      </label>
                    </div>
                    {formError && <p className="become-expert-form-error">{formError}</p>}
                    <button type="submit" className="btn primary full-width" disabled={submitting}>
                      {submitting ? 'Invio in corso...' : 'Invia candidatura'}
                    </button>
                  </form>
                )}
              </article>
            </section>
          )}
        </article>
      </section>
    </div>
  );
}
