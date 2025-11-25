import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client.js';

export default function Register() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', accountType: 'consumer' });
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const returnTo = params.get('returnTo');
  const loginLink = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';
  const loginVerifyLink = returnTo
    ? `/login?returnTo=${encodeURIComponent(returnTo)}&verify=sent`
    : '/login?verify=sent';

  const update = evt => {
    const { name, value } = evt.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const submit = async evt => {
    evt.preventDefault();
    if (loading) return;
    try {
      setLoading(true);
      
      // Add registration animation class
      document.body.classList.add('auth-transitioning');
      
      const res = await client.post('/auth/signup', form);
      toast.success(res.data.message || 'Registrazione completata!');
      setSentTo(form.email);
      
      // Smooth transition to success state
      setTimeout(() => {
        setCompleted(true);
        document.body.classList.remove('auth-transitioning');
      }, 300);
    } catch (error) {
      document.body.classList.remove('auth-transitioning');
      const message = error?.response?.data?.message || 'Registrazione non riuscita.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container auth-layout">
      <div className="auth-panel">
        <p className="eyebrow">Registrati</p>
        {completed ? (
          <div className="auth-success">
            <h1>Controlla la tua email</h1>
            <p className="muted">
              Ti abbiamo inviato un link di verifica {sentTo ? `a ${sentTo}` : ''}. Clicca sul pulsante nell'email per attivare l'account e iniziare a usare Rivelya.
            </p>
            <div className="auth-success-actions">
              <Link to={loginVerifyLink} className="btn primary">Vai al login</Link>
              <button type="button" className="btn ghost" onClick={() => setCompleted(false)}>Compila di nuovo</button>
            </div>
            <p className="muted">Hai già verificato? <Link to="/login">Accedi qui</Link></p>
          </div>
        ) : (
          <>
            <h1>Crea il tuo account Rivelya</h1>
            <p className="muted">
              Accedi a una rete selezionata di esperti certificati. Ricariche veloci, cronologia trasparente e prime consulenze con bonus di benvenuto.
            </p>
            <form className="form" onSubmit={submit}>
              <fieldset className="form-fieldset">
                <legend>Tipo di account</legend>
                <div className="account-type-toggle" role="radiogroup" aria-label="Tipo di account">
                  <button
                    type="button"
                    className={`pill${form.accountType === 'consumer' ? ' active' : ''}`}
                    role="radio"
                    aria-checked={form.accountType === 'consumer'}
                    onClick={() => setForm(prev => ({ ...prev, accountType: 'consumer' }))}
                  >
                    Cliente
                  </button>
                  <button
                    type="button"
                    className={`pill${form.accountType === 'master' ? ' active' : ''}`}
                    role="radio"
                    aria-checked={form.accountType === 'master'}
                    onClick={() => setForm(prev => ({ ...prev, accountType: 'master' }))}
                  >
                    Esperti professionista
                  </button>
                </div>
                <p className="micro muted">
                  I Esperti riceveranno un profilo dedicato con orari configurabili dopo la verifica dell'email.
                </p>
              </fieldset>
              <div className="form-grid">
                <label className="input-label">
                  Nome
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={update}
                    placeholder="Nome"
                  />
                </label>
                <label className="input-label">
                  Cognome
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={update}
                    placeholder="Cognome"
                  />
                </label>
              </div>
              <label className="input-label">
                Email professionale
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={update}
                  placeholder="nome@azienda.it"
                  required
                />
              </label>
              <label className="input-label">
                Telefono (opzionale)
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={update}
                  placeholder="+39 3XX XXX XXXX"
                />
              </label>
              <label className="input-label">
                Password
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={update}
                  placeholder="Minimo 6 caratteri"
                  minLength={6}
                  required
                />
              </label>
              <button type="submit" className="btn primary" disabled={loading}>
                {loading ? 'Creo l’account…' : 'Crea account'}
              </button>
            </form>
            <p className="muted">
              Hai già un account? <Link to={loginLink}>Accedi</Link>
            </p>
          </>
        )}
      </div>
      <div className="auth-sidecard">
        <div className="sidecard-headline">
          <span className="badge-soft">Perché Rivelya</span>
          <h2>Un network selezionato di professionisti certificati</h2>
        </div>
        <ul className="sidecard-list">
          <li>
            <span className="list-icon">✨</span>
            Profilazione accurata di ogni Esperti con recensioni verificate.
          </li>
          <li>
            <span className="list-icon">⚡️</span>
            Attiva consulenze telefoniche o chat in pochi minuti, 24/7.
          </li>
          <li>
            <span className="list-icon">🔒</span>
            Pagamenti sicuri, cronologia movimenti e promozioni dedicate.
          </li>
        </ul>
      
      </div>
    </section>
  );
}
