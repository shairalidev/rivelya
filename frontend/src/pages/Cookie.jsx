export default function Cookie() {
  return (
    <section className="container">
      <div className="section-head">
        <h1>Informativa sui Cookie</h1>
        <p className="muted">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}</p>
      </div>

      <div className="legal-content">
        <h2>1. Cosa sono i Cookie</h2>
        <p>I cookie sono piccoli file di testo che vengono memorizzati sul tuo dispositivo quando visiti il nostro sito web. Ci aiutano a fornire un'esperienza migliore e personalizzata.</p>

        <h2>2. Tipi di Cookie Utilizzati</h2>

        <h3>Cookie Tecnici (Necessari)</h3>
        <p>Essenziali per il funzionamento del sito:</p>
        <ul>
          <li><strong>Autenticazione:</strong> mantengono la sessione di login.</li>
          <li><strong>Sicurezza:</strong> proteggono da attacchi CSRF e uso non autorizzato.</li>
          <li><strong>Preferenze:</strong> ricordano le impostazioni dell'utente.</li>
        </ul>

        <h3>Cookie Analitici</h3>
        <p>Ci aiutano a capire come viene utilizzato il sito:</p>
        <ul>
          <li>Pagine piu' visitate.</li>
          <li>Tempo di permanenza.</li>
          <li>Percorsi di navigazione.</li>
        </ul>

        <h3>Cookie di Terze Parti</h3>
        <ul>
          <li><strong>Stripe:</strong> per elaborare i pagamenti in sicurezza.</li>
          <li><strong>Google:</strong> per l'autenticazione con Google.</li>
          <li><strong>Twilio:</strong> per le chiamate vocali.</li>
        </ul>

        <h2>3. Durata dei Cookie</h2>
        <ul>
          <li><strong>Cookie di sessione:</strong> eliminati alla chiusura del browser.</li>
          <li><strong>Cookie persistenti:</strong> conservati fino alla scadenza o cancellazione manuale.</li>
        </ul>

        <h2>4. Gestione dei Cookie</h2>
        <p>Puoi gestire i cookie attraverso:</p>
        <ul>
          <li>Le impostazioni del tuo browser.</li>
          <li>Il pannello delle preferenze cookie sul nostro sito.</li>
          <li>Strumenti di opt-out delle terze parti.</li>
        </ul>

        <h2>5. Cookie Essenziali</h2>
        <p>Alcuni cookie sono strettamente necessari per il funzionamento del sito e non possono essere disabilitati:</p>
        <ul>
          <li>Token di autenticazione.</li>
          <li>Preferenze di sicurezza.</li>
          <li>Stato della sessione.</li>
        </ul>

        <h2>6. Consenso</h2>
        <p>Utilizzando il nostro sito, acconsenti all'uso dei cookie come descritto in questa informativa. Puoi modificare le tue preferenze in qualsiasi momento.</p>

        <h2>7. Contatti</h2>
        <p>Per domande sui cookie o sulle impostazioni di consenso, contattaci a: <a href="mailto:privacy@rivelya.com">privacy@rivelya.com</a></p>
        <p>Red Line - gestore del servizio "Rivelya", P. IVA 10051650017, con sede legale in Italia.</p>
      </div>
    </section>
  );
}
