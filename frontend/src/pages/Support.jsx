const clientIssues = [
  { label: 'Pagamenti', value: 'pagamenti' },
  { label: 'Wallet', value: 'wallet' },
  { label: 'Chat', value: 'chat' },
  { label: 'Chiamate', value: 'chiamate' },
  { label: 'Account', value: 'account' }
];

const masterIssues = [
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
  { value: 'master', label: 'Master' }
];

export default function Support() {
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
          <button type="button" className="btn primary full-width">Supporto Clienti</button>
        </article>

        <article className="support-card">
          <div className="support-card-head">
            <p className="support-card-label">Master (Esperti)</p>
            <p className="muted micro">Supporto professionale</p>
          </div>
          <p className="support-card-copy">Per assistenza su:</p>
          <ul className="support-card-list">
            {masterIssues.map(issue => (
              <li key={issue.value}>{issue.label}</li>
            ))}
          </ul>
          <button type="button" className="btn ghost full-width">Supporto Master</button>
        </article>
      </div>

      <div className="support-forms">
        <article className="support-form-card single">
          <div className="support-form-card-head">
            <h2>Modulo di Assistenza</h2>
            <p className="muted">Descrivi il problema e indica se riguarda un cliente o un master. Ti risponderemo entro 24/48 ore.</p>
          </div>
          <form className="support-form">
            <label className="input-label">
              La segnalazione riguarda
              <select defaultValue="">
                <option value="" disabled>Seleziona</option>
                {complaintTargets.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="input-label">
              Nome
              <input type="text" placeholder="Es. Maria Rossi" />
            </label>
            <label className="input-label">
              Email
              <input type="email" placeholder="nome@email.com" />
            </label>
            <label className="input-label">
              Tipo di problema
              <select defaultValue="">
                <option value="" disabled>Seleziona opzione</option>
                {selectOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="input-label">
              Descrizione
              <textarea rows="4" placeholder="Scrivi i dettagli..." />
            </label>
            <label className="input-label">
              Screenshot (opzionale)
              <input type="file" accept="image/*" />
            </label>
            <label className="checkbox-label">
              Acconsento al trattamento dei dati personali secondo la privacy policy.
              <input type="checkbox" />
            </label>  
            
            <button type="submit" className="btn primary">Invia richiesta</button>
          </form>
        </article>
      </div>

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
