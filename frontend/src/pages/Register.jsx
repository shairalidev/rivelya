import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client.js';

export default function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const returnTo = params.get('returnTo');
  const loginLink = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';

  const update = evt => {
    const { name, value } = evt.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const submit = async evt => {
    evt.preventDefault();
    if (loading) return;
    try {
      setLoading(true);
      const res = await client.post('/auth/signup', form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      toast.success('Benvenuto in Rivelya!');
      window.dispatchEvent(new Event('rivelya-auth-change'));
      const target = returnTo || '/wallet';
      navigate(target);
    } catch (error) {
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
        <h1>Crea il tuo account Rivelya</h1>
        <p className="muted">
          Accedi a una rete selezionata di master certificati. Ricariche veloci, cronologia trasparente e prime consulenze con bonus di benvenuto.
        </p>
        <form className="form" onSubmit={submit}>
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
      </div>
      <div className="auth-sidecard">
        <div className="sidecard-headline">
          <span className="badge-soft">Perché Rivelya</span>
          <h2>Un network selezionato di professionisti certificati</h2>
        </div>
        <ul className="sidecard-list">
          <li>
            <span className="list-icon">✨</span>
            Profilazione accurata di ogni master con recensioni verificate.
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
        <div className="sidecard-cta">
          <p className="muted">Password demo suggerita: <code>Rivelya!2024</code></p>
          <p className="muted">Potrai modificarla in seguito dalla tua area personale.</p>
        </div>
      </div>
    </section>
  );
}
