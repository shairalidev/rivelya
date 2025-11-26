export default function Privacy() {
  return (
    <section className="container">
      <div className="section-head">
        <h1>Informativa sulla Privacy</h1>
        <p className="muted">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}</p>
      </div>

      <div className="legal-content">
        <h2>1. Titolare del Trattamento</h2>
        <p>RedLine S.r.l., gestore del servizio \"Rivelya\", P. IVA 10051650017 con sede legale in Italia, e' il titolare del trattamento dei dati personali raccolti attraverso la piattaforma.</p>

        <h2>2. Dati Raccolti</h2>
        <p>Raccogliamo i seguenti tipi di dati:</p>
        <ul>
          <li><strong>Dati di registrazione:</strong> nome, cognome, email, telefono.</li>
          <li><strong>Dati di pagamento:</strong> informazioni necessarie per le transazioni (gestite tramite Stripe).</li>
          <li><strong>Dati di utilizzo:</strong> sessioni, chat, chiamate, recensioni e log di sicurezza.</li>
          <li><strong>Dati tecnici:</strong> indirizzo IP, browser, dispositivo, dati di prestazione e diagnostica.</li>
        </ul>

        <h2>3. Finalita del Trattamento</h2>
        <p>I dati vengono trattati per:</p>
        <ul>
          <li>Fornire e migliorare i servizi di consulenza online.</li>
          <li>Gestire pagamenti, fatturazione e prevenire frodi.</li>
          <li>Gestire l'assistenza clienti e le comunicazioni operative.</li>
          <li>Adempiere agli obblighi di legge e di conformita.</li>
        </ul>

        <h2>4. Base Giuridica</h2>
        <p>Il trattamento e' basato su:</p>
        <ul>
          <li>Consenso dell'interessato, dove richiesto.</li>
          <li>Esecuzione del contratto e misure precontrattuali.</li>
          <li>Interesse legittimo del titolare (sicurezza, prevenzione frodi, miglioramento del servizio).</li>
          <li>Adempimento di obblighi legali e fiscali.</li>
        </ul>

        <h2>5. Conservazione dei Dati</h2>
        <p>I dati sono conservati per il tempo necessario alle finalita dichiarate e, in ogni caso, non oltre i termini prescritti dalla legge (fino a 10 anni per obblighi fiscali e contabili, salvo contenziosi in corso).</p>

        <h2>6. Diritti dell'Interessato</h2>
        <p>Hai diritto di:</p>
        <ul>
          <li>Accedere, rettificare o cancellare i tuoi dati personali.</li>
          <li>Limitare o opporti al trattamento nei casi previsti.</li>
          <li>Richiedere la portabilita dei dati.</li>
          <li>Revocare il consenso in qualsiasi momento, senza pregiudicare i trattamenti gia effettuati.</li>
          <li>Presentare reclamo al Garante per la Protezione dei Dati Personali.</li>
        </ul>

        <h2>7. Sicurezza</h2>
        <p>Applichiamo misure tecniche e organizzative adeguate per proteggere i dati personali da accessi non autorizzati, perdita o distruzione, inclusa la cifratura dei dati in transito e controlli di accesso basati sui ruoli.</p>

        <h2>8. Contatti</h2>
        <p>Per esercitare i tuoi diritti o per qualsiasi domanda sulla privacy, contattaci a: <a href="mailto:privacy@rivelya.com">privacy@rivelya.com</a></p>
        <p>RedLine S.r.l. - gestore del servizio \"Rivelya\", P. IVA 10051650017, con sede legale in Italia.</p>
      </div>
    </section>
  );
}
