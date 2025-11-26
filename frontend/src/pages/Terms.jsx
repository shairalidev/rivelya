export default function Terms() {
  return (
    <section className="container">
      <div className="section-head">
        <h1>Termini e Condizioni di Servizio</h1>
        <p className="muted">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}</p>
      </div>

      <div className="legal-content">
        <h2>1. Accettazione dei Termini</h2>
        <p>Utilizzando Rivelya, accetti integralmente questi termini e condizioni. Se non accetti questi termini, ti invitiamo a non utilizzare il servizio.</p>

        <h2>2. Descrizione del Servizio</h2>
        <p>Rivelya e' una piattaforma che connette clienti con esperti certificati per consulenze a pagamento tramite chat e chiamate vocali nei settori:</p>
        <ul>
          <li>Cartomanzia e Divinazione</li>
          <li>Spiritualita' e Intuizione</li>
          <li>Benessere interiore e Life Coaching</li>
        </ul>

        <h2>3. Registrazione e Account</h2>
        <ul>
          <li>Devi avere almeno 18 anni per utilizzare il servizio.</li>
          <li>Le informazioni fornite devono essere accurate e aggiornate.</li>
          <li>Sei responsabile della sicurezza del tuo account.</li>
          <li>E' consentito un solo account per persona fisica.</li>
        </ul>

        <h2>4. Pagamenti e Tariffe</h2>
        <ul>
          <li>I servizi vengono fatturati al minuto secondo le tariffe pubblicate nella piattaforma.</li>
          <li>I pagamenti e le transazioni sono elaborati tramite Stripe.</li>
          <li>Le ricariche del wallet sono disponibili immediatamente dopo la conferma del pagamento.</li>
          <li>Eventuali rimborsi seguono la nostra politica di rimborso.</li>
          <li>L'utente e' responsabile della correttezza dei propri metodi di pagamento.</li>
        </ul>

        <h2>5. Condotta degli Utenti</h2>
        <p>E' vietato:</p>
        <ul>
          <li>Utilizzare il servizio per scopi illegali.</li>
          <li>Molestare, minacciare o abusare di altri utenti.</li>
          <li>Condividere contenuti inappropriati o offensivi.</li>
          <li>Tentare di aggirare i sistemi di pagamento.</li>
          <li>Creare account multipli.</li>
        </ul>

        <h2>6. Responsabilita degli Esperti</h2>
        <ul>
          <li>Gli esperti sono professionisti indipendenti.</li>
          <li>Devono completare il processo di verifica KYC.</li>
          <li>Sono responsabili della qualita delle loro consulenze.</li>
          <li>Devono rispettare gli orari di disponibilita pubblicati.</li>
        </ul>

        <h2>7. Limitazione di Responsabilita</h2>
        <p>Rivelya fornisce una piattaforma di connessione. Non siamo responsabili per:</p>
        <ul>
          <li>La qualita o accuratezza delle consulenze.</li>
          <li>Decisioni prese basandosi sulle consulenze.</li>
          <li>Problemi tecnici temporanei.</li>
          <li>Contenuti generati dagli utenti.</li>
        </ul>

        <h2>8. Proprieta Intellettuale</h2>
        <ul>
          <li>Rivelya detiene tutti i diritti sulla piattaforma.</li>
          <li>Gli utenti mantengono i diritti sui propri contenuti.</li>
          <li>E' vietato copiare o riprodurre parti della piattaforma.</li>
        </ul>

        <h2>9. Sospensione e Terminazione</h2>
        <p>Possiamo sospendere o terminare account per:</p>
        <ul>
          <li>Violazione dei termini di servizio.</li>
          <li>Attivita fraudolente.</li>
          <li>Comportamenti inappropriati.</li>
          <li>Richiesta dell'utente.</li>
        </ul>

        <h2>10. Modifiche ai Termini</h2>
        <p>Ci riserviamo il diritto di modificare questi termini. Gli utenti saranno notificati delle modifiche significative.</p>

        <h2>11. Legge Applicabile</h2>
        <p>Questi termini sono regolati dalla legge italiana. Qualsiasi controversia sara' risolta presso i tribunali competenti in Italia.</p>

        <h2>12. Contatti</h2>
        <p>Per domande sui Termini di Servizio e' possibile contattarci all'indirizzo: <a href="mailto:legal@rivelya.com">legal@rivelya.com</a></p>
        <p>Il servizio \"Rivelya\" e' gestito da RedLine, P. IVA 10051650017, con sede legale in Italia.</p>
      </div>
    </section>
  );
}
