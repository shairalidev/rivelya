import { Link } from 'react-router-dom';

export default function Experience() {
  return (
    <div className="experience-page">
      <section className="container section experience-section" id="esperienze">
        <div className="section-head mystic-head">
          <span className="badge-soft">Esperienze su Rivelya</span>
          <h2>Esperienze su Rivelya</h2>
        </div>

        <div className="experience-aurora">
          <div className="experience-intro">
            <p className="lead">Un viaggio interiore, guidato da chi sa ascoltare l'anima.</p>
            <div className="experience-intro-subtext">
              <p className="muted">
                Su Rivelya trovi esperienze create per riportarti al centro: momenti in cui puoi fermarti, ascoltarti e lasciarti guidare da chi ha fatto della sensibilit&agrave; un dono e della guida un mestiere.
              </p>
              <p className="muted">
                Qui non parliamo di categorie. Parliamo di ci&ograve; che vivi, senti e trasformi.
              </p>
            </div>
          </div>
          <div className="experience-veil" aria-hidden="true">
            <span></span>
            <span></span>
          </div>
        </div>

        <div className="experience-grid-wrapper">
          <div className="experience-orbit" aria-hidden="true"></div>
          <div className="experience-grid">
            <article className="experience-card">
              <h3>Chiarezza</h3>
              <p>
                Quando la mente si confonde e senti il bisogno di una risposta nitida, di un segno o di una direzione. Le nostre guide ti accompagnano a vedere ci&ograve; che gi&agrave; esiste dentro di te.
              </p>
            </article>

            <article className="experience-card">
              <h3>Connessione</h3>
              <p>
                Un'esperienza che ti avvicina ai tuoi simboli interiori, alla tua intuizione profonda, al linguaggio dell'energia che ti circonda.
              </p>
            </article>

            <article className="experience-card">
              <h3>Riequilibrio</h3>
              <p>
                Per ritrovare calma, respiro, centratura e leggerezza quando il mondo esterno pesa troppo e hai bisogno di rimetterti al centro.
              </p>
            </article>

            <article className="experience-card">
              <h3>Trasformazione</h3>
              <p>
                Un percorso che scioglie e libera: emozioni bloccate, cicli ripetuti, nodi interiori che aspettano solo di essere ascoltati e superati.
              </p>
            </article>

            <article className="experience-card">
              <h3>Allineamento</h3>
              <p>
                Quando senti che qualcosa sta cambiando in te e sei pronta a fare un passo avanti, con la guida di chi pu&ograve; aiutarti a leggere le tue energie.
              </p>
            </article>
          </div>
        </div>

        <div className="experience-verse">
          <article className="experience-card experience-card--highlight">
            <h3>Il cuore delle nostre esperienze</h3>
            <ul className="muted experience-points">
              <li>un incontro autentico,</li>
              <li>una guida sensibile e professionale,</li>
              <li>uno spazio sicuro,</li>
              <li>un momento per ritrovare te stessa,</li>
              <li>un ponte tra ci&ograve; che vivi oggi e ci&ograve; che desideri diventare.</li>
            </ul>
          </article>

          <article className="experience-card experience-card--cta">
            <h3>Lasciati guidare</h3>
            <p>
              Ora scegli il modo in cui vuoi essere accompagnata. Segui ci&ograve; che senti e accedi agli esperti che risuonano con la tua energia.
            </p>
            <Link to="/catalog" className="link">
              &rarr; Esplora gli Esperti
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
