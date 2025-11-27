export default function Business() {
  return (
    <section className="business-page container">
      <div className="section-head">
        <h1>Business & Collaborazioni Professionali</h1>
        <p className="muted">
          La nostra piattaforma offre soluzioni dedicate a esperti, aziende e partner che desiderano instaurare una collaborazione professionale con Rivelia.
          Scegli l’area più adatta alle tue esigenze.
        </p>
      </div>

      <div className="business-grid">
        <article className="business-card">
          <div className="card-number"></div>
          <h2>Collabora come Esperto</h2>
          <p>
            Entra a far parte della nostra squadra di astrologi, tarologi, coach e professionisti del benessere.
            Offriamo massima visibilità, strumenti avanzati, pagamenti sicuri e un ambiente professionale in cui esprimere le tue competenze.
          </p>
          <a className="cta-link" href="/become-expert">→ Candidati per diventare un Esperto su Rivelia</a>
        </article>

        <article className="business-card">
          <div className="card-number"></div>
          <h2>Soluzioni per Aziende &amp; Brand</h2>
          <p>
            Rivelia supporta aziende, enti e realtà professionali che desiderano offrire ai propri dipendenti servizi di consulenza personalizzata nel campo dello sviluppo personale, del benessere e della crescita interiore.
          </p>
          <p className="business-list-heading">Mettiamo a disposizione:</p>
          <ul className="business-list">
            <li>pacchetti di sessioni dedicate ai team,</li>
            <li>eventi aziendali con i nostri esperti,</li>
            <li>abbonamenti per i dipendenti,</li>
            <li>consulenze personalizzate per HR e management,</li>
            <li>soluzioni professionali regolamentate da SLA.</li>
          </ul>
          <a className="cta-link" href="/business">→ Richiedi una collaborazione aziendale</a>
        </article>

        <article className="business-card">
          <div className="card-number"></div>
          <h2>Partnership &amp; Integrazioni</h2>
          <p>
            Rivelia collabora anche con aziende, brand e realtà tecnologiche interessate a sviluppare progetti congiunti o integrazioni avanzate.
          </p>
          <p className="business-list-heading">Questo spazio è dedicato a:</p>
          <ul className="business-list">
            <li>partnership commerciali,</li>
            <li>collaborazioni con brand affini,</li>
            <li>integrazioni API,</li>
            <li>fornitori e servizi esterni,</li>
            <li>programmi di affiliazione,</li>
            <li>accordi tecnici e professionali.</li>
          </ul>
          <a className="cta-link" href="/business">→ Proponi una partnership o un’integrazione</a>
        </article>
      </div>

      <article className="business-card closing">
        
        <p>
          Per qualunque richiesta professionale, il nostro team è a disposizione per valutare la soluzione più adatta.
          Scegli l’area di tuo interesse tra i box qui sopra e utilizza il pulsante dedicato per inviare la tua richiesta o candidatura.
        </p>
      </article>
    </section>
  );
}
