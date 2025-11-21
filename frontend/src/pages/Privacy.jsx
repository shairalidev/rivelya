export default function Privacy() {
  return (
    <section className="container">
      <div className="section-head">
        <h1>Informativa sulla Privacy</h1>
        <p className="muted">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}</p>
      </div>

      <div className="legal-content">
        <h2>1. Titolare del Trattamento</h2>
        <p>Rivelya S.r.l., con sede in Italia, Partita IVA: 10051650017, è il titolare del trattamento dei dati personali raccolti attraverso la piattaforma.</p>

        <h2>2. Dati Raccolti</h2>
        <p>Raccogliamo i seguenti tipi di dati:</p>
        <ul>
          <li><strong>Dati di registrazione:</strong> nome, cognome, email, telefono</li>
          <li><strong>Dati di pagamento:</strong> informazioni necessarie per le transazioni (gestite tramite Stripe)</li>
          <li><strong>Dati di utilizzo:</strong> sessioni, chat, chiamate, recensioni</li>
          <li><strong>Dati tecnici:</strong> indirizzo IP, browser, dispositivo</li>
        </ul>

        <h2>3. Finalità del Trattamento</h2>
        <p>I dati vengono trattati per:</p>
        <ul>
          <li>Fornire i servizi di consulenza online</li>
          <li>Gestire pagamenti e fatturazione</li>
          <li>Migliorare la qualità del servizio</li>
          <li>Adempiere agli obblighi legali</li>
        </ul>

        <h2>4. Base Giuridica</h2>
        <p>Il trattamento è basato su:</p>
        <ul>
          <li>Consenso dell'interessato</li>
          <li>Esecuzione del contratto</li>
          <li>Interesse legittimo del titolare</li>
          <li>Adempimento di obblighi legali</li>
        </ul>

        <h2>5. Conservazione dei Dati</h2>
        <p>I dati vengono conservati per il tempo necessario alle finalità per cui sono stati raccolti e comunque non oltre 10 anni dalla cessazione del rapporto.</p>

        <h2>6. Diritti dell'Interessato</h2>
        <p>Hai diritto di:</p>
        <ul>
          <li>Accedere ai tuoi dati personali</li>
          <li>Rettificare dati inesatti</li>
          <li>Cancellare i dati (diritto all'oblio)</li>
          <li>Limitare il trattamento</li>
          <li>Portabilità dei dati</li>
          <li>Opporti al trattamento</li>
        </ul>

        <h2>7. Sicurezza</h2>
        <p>Implementiamo misure tecniche e organizzative appropriate per proteggere i dati personali da accessi non autorizzati, perdita o distruzione.</p>

        <h2>8. Contatti</h2>
        <p>Per esercitare i tuoi diritti o per qualsiasi domanda sulla privacy, contattaci a: <a href="mailto:privacy@rivelya.com">privacy@rivelya.com</a></p>
      </div>
    </section>
  );
}