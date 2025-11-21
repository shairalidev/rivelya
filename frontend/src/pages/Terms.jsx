export default function Terms() {
  return (
    <section className="container">
      <div className="section-head">
        <h1>Termini e Condizioni di Servizio</h1>
        <p className="muted">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}</p>
      </div>

      <div className="legal-content">
        <h2>1. Accettazione dei Termini</h2>
        <p>Utilizzando Rivelya, accetti integralmente questi termini e condizioni. Se non accetti questi termini, non utilizzare il servizio.</p>

        <h2>2. Descrizione del Servizio</h2>
        <p>Rivelya è una piattaforma che connette clienti con esperti certificati per consulenze a pagamento tramite chat e chiamate vocali nei settori:</p>
        <ul>
          <li>Cartomanzia e Divinazione</li>
          <li>Spiritualità e Intuizione</li>
          <li>Benessere Interiore e Life Coaching</li>
        </ul>

        <h2>3. Registrazione e Account</h2>
        <ul>
          <li>Devi avere almeno 18 anni per utilizzare il servizio</li>
          <li>Le informazioni fornite devono essere accurate e aggiornate</li>
          <li>Sei responsabile della sicurezza del tuo account</li>
          <li>Un account per persona fisica</li>
        </ul>

        <h2>4. Pagamenti e Tariffe</h2>
        <ul>
          <li>I servizi sono fatturati al minuto secondo le tariffe pubblicate</li>
          <li>I pagamenti vengono elaborati tramite Stripe</li>
          <li>Le ricariche del wallet sono immediate</li>
          <li>I rimborsi sono soggetti alla nostra politica di rimborso</li>
          <li>Rivelya trattiene il 70% delle tariffe, gli esperti ricevono il 30%</li>
        </ul>

        <h2>5. Condotta degli Utenti</h2>
        <p>È vietato:</p>
        <ul>
          <li>Utilizzare il servizio per scopi illegali</li>
          <li>Molestare, minacciare o abusare di altri utenti</li>
          <li>Condividere contenuti inappropriati o offensivi</li>
          <li>Tentare di aggirare i sistemi di pagamento</li>
          <li>Creare account multipli</li>
        </ul>

        <h2>6. Responsabilità degli Esperti</h2>
        <ul>
          <li>Gli esperti sono professionisti indipendenti</li>
          <li>Devono completare il processo di verifica KYC</li>
          <li>Sono responsabili della qualità delle loro consulenze</li>
          <li>Devono rispettare gli orari di disponibilità pubblicati</li>
        </ul>

        <h2>7. Limitazione di Responsabilità</h2>
        <p>Rivelya fornisce una piattaforma di connessione. Non siamo responsabili per:</p>
        <ul>
          <li>La qualità o accuratezza delle consulenze</li>
          <li>Decisioni prese basandosi sulle consulenze</li>
          <li>Problemi tecnici temporanei</li>
          <li>Contenuti generati dagli utenti</li>
        </ul>

        <h2>8. Proprietà Intellettuale</h2>
        <ul>
          <li>Rivelya detiene tutti i diritti sulla piattaforma</li>
          <li>Gli utenti mantengono i diritti sui propri contenuti</li>
          <li>È vietato copiare o riprodurre parti della piattaforma</li>
        </ul>

        <h2>9. Sospensione e Terminazione</h2>
        <p>Possiamo sospendere o terminare account per:</p>
        <ul>
          <li>Violazione dei termini di servizio</li>
          <li>Attività fraudolente</li>
          <li>Comportamenti inappropriati</li>
          <li>Richiesta dell'utente</li>
        </ul>

        <h2>10. Modifiche ai Termini</h2>
        <p>Ci riserviamo il diritto di modificare questi termini. Gli utenti saranno notificati delle modifiche significative.</p>

        <h2>11. Legge Applicabile</h2>
        <p>Questi termini sono regolati dalla legge italiana. Qualsiasi controversia sarà risolta presso i tribunali competenti in Italia.</p>

        <h2>12. Contatti</h2>
        <p>Per domande sui termini di servizio: <a href="mailto:legal@rivelya.com">legal@rivelya.com</a></p>
        <p>Rivelya S.r.l. - Partita IVA: 10051650017</p>
      </div>
    </section>
  );
}