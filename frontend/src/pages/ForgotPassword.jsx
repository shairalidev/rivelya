import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async evt => {
    evt.preventDefault();
    if (loading) return;
    try {
      setLoading(true);
      const res = await client.post('/auth/forgot-password', { email });
      toast.success(res.data?.message || 'Se l\'indirizzo è registrato riceverai un link per reimpostare la password.');
      setSent(true);
    } catch (error) {
      const message = error?.response?.data?.message || 'Si è verificato un errore. Riprova più tardi.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container auth-layout">
      <div className="auth-panel">
        <p className="eyebrow">Password dimenticata</p>
        <h1>Recupera l'accesso</h1>
        <p className="muted">Inserisci l'email associata al tuo account. Ti invieremo un link sicuro per impostare una nuova password.</p>
        {sent ? (
          <div className="auth-success">
            <h2>Controlla la tua posta</h2>
            <p className="muted">Se l'indirizzo è registrato riceverai a breve un'email con le istruzioni per il reset.</p>
            <div className="auth-success-actions">
              <Link to="/login" className="btn primary">Torna al login</Link>
              <button type="button" className="btn ghost" onClick={() => setSent(false)}>Invia di nuovo</button>
            </div>
          </div>
        ) : (
          <form className="form" onSubmit={submit}>
            <label className="input-label">
              Email
              <input
                type="email"
                value={email}
                onChange={evt => setEmail(evt.target.value)}
                placeholder="tuo.nome@dominio.it"
                required
              />
            </label>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Invio in corso…' : 'Invia link di reset'}
            </button>
          </form>
        )}
        <p className="muted">Ricordi la password? <Link to="/login">Accedi</Link></p>
      </div>
      <div className="auth-sidecard">
        <div className="sidecard-headline">
          <span className="badge-soft">Sicurezza</span>
          <h2>Proteggiamo il tuo account con link temporanei</h2>
        </div>
        <ul className="sidecard-list">
          <li><span className="list-icon">🔐</span> Link valido per 60 minuti per garantire la massima sicurezza.</li>
          <li><span className="list-icon">📬</span> Controlla anche la cartella spam se non trovi l'email.</li>
          <li><span className="list-icon">🤝</span> Per supporto aggiuntivo contatta l'assistenza Rivelya.</li>
        </ul>
      </div>
    </section>
  );
}
