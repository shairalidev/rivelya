export default function Cookie() {
  return (
    <section className="terms-page container">
      <header className="terms-head">
        <h1>Informativa sui Cookie – Rivelya</h1>
        <p className="terms-date">
            Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
        </p>
      </header>

      <article className="term-section">
        <h2>1. Cosa sono i Cookie</h2>
        <p>I cookie sono piccoli file di testo che vengono memorizzati sul dispositivo dell’utente quando visita un sito web.</p>
        <p>Servono per garantire il corretto funzionamento del sito, migliorare l’esperienza dell’utente, analizzare come viene utilizzato il servizio e offrire funzionalità essenziali.</p>
      </article>

      <article className="term-section">
        <h2>2. Tipi di Cookie Utilizzati</h2>
        <p>Rivelya utilizza le seguenti categorie di cookie:</p>

        <h3>A. Cookie Tecnici (Necessari)</h3>
        <p>Sono indispensabili per il funzionamento del sito e non possono essere disattivati.</p>
        <p>Servono per:</p>
        <p>• Autenticazione: mantenere la sessione di login attiva.</p>
        <p>• Sicurezza: prevenire attacchi CSRF e accessi non autorizzati.</p>
        <p>• Preferenze: salvare le impostazioni dell’utente (tema, lingua, privacy).</p>
        <p>• Stato della sessione: gestire navigazione, caricamento pagine, processi interni.</p>
        <p>• Gestione wallet: memorizzare i dati necessari alla ricarica e alla visualizzazione del saldo.</p>

        <h3>B. Cookie Analitici (Anonimi o Aggregati)</h3>
        <p>Servono a capire come viene utilizzato il sito e migliorare l’esperienza utente.</p>
        <p>Raccogliamo dati relativi a:</p>
        <p>• Pagine più visitate</p>
        <p>• Tempo di permanenza</p>
        <p>• Percorsi di navigazione</p>
        <p>• Errori tecnici</p>
        <p>• Performance della piattaforma</p>
        <p>I dati raccolti non identificano personalmente l’utente.</p>

        <h3>C. Cookie di Terze Parti</h3>
        <p>Riverya utilizza servizi esterni che installano cookie aggiuntivi necessari al funzionamento della piattaforma:</p>
        <p>• Stripe – per elaborare i pagamenti in sicurezza.</p>
        <p>• Google (Google OAuth / reCAPTCHA) – per autenticazione e sicurezza.</p>
        <p>• Twilio – per la gestione delle chiamate vocali.</p>
        <p>• Fornitori di sicurezza (Anti-DDoS / firewall) – per proteggere la piattaforma da attacchi.</p>
        <p>Tali cookie sono gestiti direttamente dalle terze parti indicate e soggetti alle relative privacy policy.</p>
      </article>

      <article className="term-section">
        <h2>3. Durata dei Cookie</h2>
        <p>• Cookie di sessione: vengono eliminati automaticamente quando chiudi il browser.</p>
        <p>• Cookie persistenti: rimangono sul tuo dispositivo fino alla scadenza o alla cancellazione manuale.</p>
      </article>

      <article className="term-section">
        <h2>4. Gestione dei Cookie</h2>
        <p>Puoi gestire o disabilitare i cookie utilizzando:</p>
        <p>• Le impostazioni del tuo browser (Safari, Chrome, Firefox, ecc.).</p>
        <p>• Il pannello delle preferenze cookie, se presente sul sito.</p>
        <p>• Gli strumenti di opt-out di terze parti, quando disponibili.</p>
        <p>Disattivare i cookie tecnici può compromettere il funzionamento del sito.</p>
      </article>

      <article className="term-section">
        <h2>5. Cookie Essenziali</h2>
        <p>Non possono essere disattivati perché necessari al funzionamento del sito.</p>
        <p>Comprendono:</p>
        <p>• Token di autenticazione</p>
        <p>• Cookie di sicurezza</p>
        <p>• Stato della sessione e routing interno</p>
        <p>• Cookie necessari per il wallet e le transazioni</p>
      </article>

      <article className="term-section">
        <h2>6. Consenso</h2>
        <p>Utilizzando la piattaforma Rivelya, l’utente acconsente all’utilizzo dei cookie come indicato in questa informativa.</p>
        <p>È possibile modificare le preferenze in qualsiasi momento tramite il browser o gli strumenti indicati.</p>
      </article>

      <article className="term-section">
        <h2>7. Contatti</h2>
        <p>Per informazioni sui cookie o sulle impostazioni di consenso, puoi scrivere a:</p>
        <p>📧 privacy@rivelya.com</p>
        <p>Il servizio “Rivelya” è gestito da Red Line, P. IVA 10051650017, con sede legale in Italia.</p>
      </article>
    </section>
  );
}
