export default function Privacy() {
  return (
    <section className="terms-page container">
      <header className="terms-head">
        <h1>Informativa sulla Privacy – Rivelya</h1>
        <p className="terms-date">
          Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
        </p>
      </header>

      <article className="term-section">
        <h2>1. Titolare del Trattamento</h2>
        <p>Il Titolare del Trattamento è Red Line, gestore del servizio “Rivelya”, P. IVA 10051650017, con sede legale in Italia.</p>
        <p>Red Line è responsabile del trattamento dei dati personali raccolti tramite la piattaforma.</p>
      </article>

      <article className="term-section">
        <h2>2. Dati Raccolti</h2>
        <p>Rivelya raccoglie le seguenti categorie di dati:</p>

        <h3>a. Dati di registrazione</h3>
        <p>• Nome e cognome</p>
        <p>• Email</p>
        <p>• Numero di telefono</p>
        <p>• Password (crittografata)</p>

        <h3>b. Dati di pagamento</h3>
        <p>• Informazioni necessarie per processare i pagamenti (gestite tramite Stripe)</p>
        <p>• ID delle transazioni</p>
        <p>• Importi, ricariche, saldo wallet</p>
        <p>Rivelya non conserva né elabora i dati completi delle carte di pagamento.</p>

        <h3>c. Dati di utilizzo</h3>
        <p>• Log delle sessioni</p>
        <p>• Durata, orari e modalità delle consulenze</p>
        <p>• Chat e chiamate (contenuto non registrato; conserviamo solo i meta-log per sicurezza e verifiche)</p>
        <p>• Recensioni</p>
        <p>• Log accessi e attività dell’account</p>

        <h3>d. Dati tecnici</h3>
        <p>• Indirizzo IP</p>
        <p>• Browser e dispositivo</p>
        <p>• Sistema operativo</p>
        <p>• Dati di prestazione e diagnostica</p>
        <p>• Cookie tecnici essenziali</p>
      </article>

      <article className="term-section">
        <h2>3. Finalità del Trattamento</h2>
        <p>I dati vengono trattati per:</p>
        <p>• Fornire e migliorare i servizi di consulenza online.</p>
        <p>• Gestire pagamenti, ricariche wallet e prevenzione frodi.</p>
        <p>• Gestire assistenza clienti e comunicazioni operative.</p>
        <p>• Garantire sicurezza, tracciamento attività e prevenzione abusi.</p>
        <p>• Adempiere a obblighi di legge, fiscali e contabili.</p>
        <p>• Proteggere gli utenti da comportamenti illeciti (es. tentativi di contatti esterni o uso improprio della piattaforma).</p>
      </article>

      <article className="term-section">
        <h2>4. Base Giuridica</h2>
        <p>Il trattamento dei dati si basa su:</p>
        <p>• Esecuzione del contratto (art. 6 GDPR).</p>
        <p>• Consenso dell’interessato, quando richiesto.</p>
        <p>• Interesse legittimo del Titolare (sicurezza, prevenzione frodi, miglioramento del servizio).</p>
        <p>• Obblighi legali e fiscali previsti dalla normativa italiana ed europea.</p>
      </article>

      <article className="term-section">
        <h2>5. Conservazione dei Dati</h2>
        <p>I dati vengono conservati per il tempo strettamente necessario alle finalità indicate e, in ogni caso:</p>
        <p>• fino a 10 anni per obblighi fiscali e contabili (come previsto dalla legge italiana);</p>
        <p>• per periodi più brevi per finalità operative, diagnostiche o di sicurezza;</p>
        <p>• per tutta la durata dell’account, salvo richiesta di cancellazione.</p>
        <p>I dati possono essere conservati più a lungo in caso di eventuali contenziosi o obblighi legali.</p>
      </article>

      <article className="term-section">
        <h2>6. Diritti dell’Interessato</h2>
        <p>L’interessato ha diritto di:</p>
        <p>• Accedere, correggere o cancellare i propri dati personali.</p>
        <p>• Richiedere limitazione o opposizione al trattamento nei casi previsti.</p>
        <p>• Ottenere la portabilità dei dati.</p>
        <p>• Revocare il consenso in qualsiasi momento, senza pregiudicare la liceità dei trattamenti già effettuati.</p>
        <p>• Presentare reclamo al Garante per la Protezione dei Dati Personali.</p>
        <p>La richiesta può essere inviata a privacy@rivelya.com.</p>
      </article>

      <article className="term-section">
        <h2>7. Sicurezza</h2>
        <p>Rivelya applica misure tecniche e organizzative adeguate per proteggere i dati da:</p>
        <p>• accessi non autorizzati</p>
        <p>• alterazione</p>
        <p>• perdita</p>
        <p>• distruzione</p>
        <p>• uso improprio</p>
        <p>Tra le misure applicate:</p>
        <p>• Cifratura dei dati in transito (HTTPS)</p>
        <p>• Controlli di accesso basati sui ruoli</p>
        <p>• Protezioni anti-intrusione</p>
        <p>• Verifica periodica dei sistemi</p>
      </article>

      <article className="term-section">
        <h2>8. Condivisione dei Dati</h2>
        <p>I dati possono essere condivisi esclusivamente con:</p>
        <p>• Fornitori tecnici necessari al funzionamento del servizio (es. Stripe, hosting, strumenti di sicurezza).</p>
        <p>• Autorità competenti in caso di richieste legali.</p>
        <p>• Collaboratori autorizzati alla manutenzione tecnica del servizio.</p>
        <p>I dati non vengono venduti a terze parti.</p>
      </article>

      <article className="term-section">
        <h2>9. Trasferimenti Extra-UE</h2>
        <p>Quando necessario, eventuali trasferimenti di dati fuori dall’UE avvengono nel rispetto del GDPR, tramite clausole contrattuali standard o provider conformi.</p>
      </article>

      <article className="term-section">
        <h2>10. Contatti</h2>
        <p>Per esercitare i diritti o per qualsiasi domanda sulla privacy, scrivi a:</p>
        <p>📧 privacy@rivelya.com</p>
        <p>Il servizio “Rivelya” è gestito da Red Line, P. IVA 10051650017, con sede legale in Italia.</p>
      </article>
    </section>
  );
}
