import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import client from '../api/client.js';

const clientIssues = [
  { label: 'Pagamenti', value: 'pagamenti' },
  { label: 'Wallet', value: 'wallet' },
  { label: 'Chat', value: 'chat' },
  { label: 'Chiamate', value: 'chiamate' },
  { label: 'Account', value: 'account' }
];

const espertiIssues = [
  { label: 'Accesso', value: 'accesso' },
  { label: 'Disponibilità', value: 'disponibilita' },
  { label: 'Chat e Chiamate', value: 'chat_chiamate' },
  { label: 'Pagamenti compensi', value: 'pagamenti_compensi' },
  { label: 'Profilo', value: 'profilo' }
];

const selectOptions = [
  { value: 'generale', label: 'Problema generale' },
  { value: 'tecnico', label: 'Problema tecnico' },
  { value: 'pagamenti', label: 'Pagamenti' },
  { value: 'account', label: 'Account' },
  { value: 'altro', label: 'Altro' }
];

const complaintTargets = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'esperto', label: 'Esperto' }
];

const initialFormState = {
  target: '',
  name: '',
  email: '',
  issueType: '',
  description: '',
  consent: false,
  screenshot: null
};

export default function Support() {
  const [form, setForm] = useState({ ...initialFormState, target: 'cliente' });
  const [activeForm, setActiveForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const formCardRef = useRef(null);

  const handleChange = event => {
    const { name, value, type, checked } = event.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = event => {
    const file = event.target.files?.[0] ?? null;
    setForm(prev => ({ ...prev, screenshot: file }));
  };

  const resetForm = target => {
    setForm({ ...initialFormState, target });
  };

  const handleSubmit = async event => {
    event.preventDefault();

    if (!form.target || !form.name || !form.email || !form.issueType || !form.description || !form.consent) {
      toast.error('Completa tutti i campi obbligatori e accetta la privacy.');
      return;
    }

    const formData = new FormData();
    formData.append('target', form.target);
    formData.append('name', form.name);
    formData.append('email', form.email);
    formData.append('issueType', form.issueType);
    formData.append('description', form.description);
    formData.append('consent', form.consent ? 'on' : 'off');
    if (form.screenshot) {
      formData.append('screenshot', form.screenshot);
    }

    setSubmitting(true);
    try {
      const response = await client.post('/support', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(response.data?.message || 'Richiesta inviata, ti contatteremo a breve.');
      resetForm(activeForm ?? 'cliente');
      setActiveForm(null);
    } catch (error) {
      const message = error?.response?.data?.message || 'Impossibile inviare la richiesta. Riprova.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToForm = () => {
    if (formCardRef.current) {
      formCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleQuickJump = target => {
    setActiveForm(target);
    resetForm(target);
    setTimeout(scrollToForm, 100);
  };

  const handleCloseForm = () => {
    setActiveForm(null);
  };

  const formTitle = activeForm === 'esperto' ? 'Esperti' : 'Clienti';

  return (
    <section className="container support-page">
      <div className="section-head">
        <span className="badge-soft">Supporto</span>
        <h1>Assistenza Rivelya</h1>
        <p className="muted">Come possiamo aiutarti?</p>
      </div>

      <div className="support-quick">
        <article className="support-card">
          <div className="support-card-head">
            <p className="support-card-label">Clienti</p>
            <p className="muted micro">Assistenza dedicata</p>
          </div>
          <p className="support-card-copy">Per problemi riguardo:</p>
          <ul className="support-card-list">
            {clientIssues.map(issue => (
              <li key={issue.value}>{issue.label}</li>
            ))}
          </ul>
          <button
            type="button"
            className="btn primary full-width"
            onClick={() => handleQuickJump('cliente')}
          >
            Supporto Clienti
          </button>
        </article>

        <article className="support-card">
          <div className="support-card-head">
            <p className="support-card-label">Esperti</p>
            <p className="muted micro">Supporto professionale</p>
          </div>
          <p className="support-card-copy">Per assistenza su:</p>
          <ul className="support-card-list">
            {espertiIssues.map(issue => (
              <li key={issue.value}>{issue.label}</li>
            ))}
          </ul>
          <button
            type="button"
            className="btn ghost full-width"
            onClick={() => handleQuickJump('esperto')}
          >
            Supporto Esperti
          </button>
        </article>
      </div>

      {activeForm && (
        <div className="support-forms" ref={formCardRef}>
          <article className="support-form-card single">
            <div className="support-form-card-head">
              <div className="support-form-header">
                <h2>Modulo di assistenza per {formTitle}</h2>
                <button type="button" className="btn ghost small" onClick={handleCloseForm}>
                  Chiudi modulo
                </button>
              </div>
              <p className="muted">
                Specifica il tipo di richiesta ({formTitle}), allega informazioni utili e invia il modulo:
                risponderemo entro 24/48 ore.
              </p>
            </div>
            <form className="support-form" onSubmit={handleSubmit}>
              <label className="input-label">
                La segnalazione riguarda
                <select name="target" value={form.target} onChange={handleChange} required>
                  <option value="" disabled>Seleziona</option>
                  {complaintTargets.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="input-label">
                Nome
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  type="text"
                  placeholder={form.target === 'esperto' ? 'Es. Matteo Bianchi (Esperto)' : 'Es. Maria Rossi'}
                  required
                />
              </label>
              <label className="input-label">
                Email
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  type="email"
                  placeholder="nome@email.com"
                  required
                />
              </label>
              <label className="input-label">
                Tipo di problema
                <select name="issueType" value={form.issueType} onChange={handleChange} required>
                  <option value="" disabled>Seleziona opzione</option>
                  {selectOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="input-label">
                Descrizione
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows="4"
                  placeholder={
                    form.target === 'esperto'
                      ? 'Hai bisogno di supporto su disponibilità, pagamenti o profilo esperto?'
                      : 'Descrivi il problema relativo a chat, pagamento o account...'
                  }
                  required
                />
              </label>
              <label className="input-label">
                Screenshot (opzionale)
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
                {form.screenshot && (
                  <span className="micro muted">File selezionato: {form.screenshot.name}</span>
                )}
              </label>
              <label className="checkbox-label" htmlFor="support-consent">
                <span>Acconsento al trattamento dei dati personali secondo la privacy policy.</span>
                <input
                  id="support-consent"
                  name="consent"
                  type="checkbox"
                  checked={form.consent}
                  onChange={handleChange}
                  required
                />
              </label>
              <button
                type="submit"
                className="btn primary"
                disabled={submitting || !form.consent}
              >
                {submitting ? 'Invio in corso...' : 'Invia richiesta'}
              </button>
            </form>
          </article>
        </div>
      )}

      <section className="support-contact">
        <h2>Tempi e contatti</h2>
        <p className="muted">Rispondiamo entro 24/48 ore, 7 giorni su 7.</p>
        <div className="support-contact-grid">
          <div>
            <p className="support-contact-label">Tempi di risposta</p>
            <p>24/48 ore lavorative</p>
          </div>
          <div>
            <p className="support-contact-label">Email</p>
            <a href="mailto:support@rivelya.com" className="support-contact-link">support@rivelya.com</a>
          </div>
          <div>
            <p className="support-contact-label">Disponibilità</p>
            <p>7 giorni su 7</p>
          </div>
        </div>
      </section>
    </section>
  );
}
