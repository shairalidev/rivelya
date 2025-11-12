import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(token ? 'ready' : 'missing');

  useEffect(() => {
    if (!token) {
      setStatus('missing');
    }
  }, [token]);

  const update = evt => {
    const { name, value } = evt.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const submit = async evt => {
    evt.preventDefault();
    if (loading || status !== 'ready') return;
    if (form.password.length < 6) {
      toast.error('La password deve contenere almeno 6 caratteri.');
      return;
    }
    if (form.password !== form.confirm) {
      toast.error('Le password non coincidono.');
      return;
    }
    try {
      setLoading(true);
      const res = await client.post('/auth/reset-password', { token, password: form.password });
      toast.success(res.data?.message || 'Password aggiornata con successo.');
      setStatus('success');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (error) {
      const message = error?.response?.data?.message || 'Link non valido o scaduto. Richiedi un nuovo reset.';
      toast.error(message);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container auth-layout">
      <div className="auth-panel">
        <p className="eyebrow">Nuova password</p>
        <h1>Imposta le nuove credenziali</h1>
        {status === 'missing' && (
          <p className="muted">Il link non è valido. Richiedi un nuovo reset dalla pagina <Link to="/forgot-password">password dimenticata</Link>.</p>
        )}
        {status === 'ready' && (
          <form className="form" onSubmit={submit}>
            <label className="input-label">
              Nuova password
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={update}
                placeholder="Minimo 6 caratteri"
                minLength={6}
                required
              />
            </label>
            <label className="input-label">
              Conferma password
              <input
                type="password"
                name="confirm"
                value={form.confirm}
                onChange={update}
                placeholder="Ripeti la password"
                minLength={6}
                required
              />
            </label>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Aggiornamento…' : 'Imposta password'}
            </button>
          </form>
        )}
        {status === 'success' && (
          <div className="auth-success">
            <h2>Password aggiornata</h2>
            <p className="muted">Stai per essere reindirizzato al login. Se non accade, <Link to="/login">clicca qui</Link>.</p>
          </div>
        )}
        {status === 'error' && (
          <div className="alert">
            Link scaduto. <Link to="/forgot-password">Richiedi un nuovo link</Link> e riprova.
          </div>
        )}
      </div>
      <div className="auth-sidecard">
        <div className="sidecard-headline">
          <span className="badge-soft">Consiglio</span>
          <h2>Usa una password unica e sicura</h2>
        </div>
        <ul className="sidecard-list">
          <li><span className="list-icon">🔑</span> Combina lettere maiuscole, minuscole, numeri e simboli.</li>
          <li><span className="list-icon">🛡️</span> Aggiorna regolarmente le tue credenziali per maggiore sicurezza.</li>
          <li><span className="list-icon">💡</span> Attiva l'autenticazione a due fattori quando disponibile.</li>
        </ul>
      </div>
    </section>
  );
}
