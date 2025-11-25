import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client.js';
import GoogleLoginButton from '../components/GoogleLoginButton.jsx';
import { notifyAuthChange, setToken, setUser as storeUser } from '../lib/auth.js';

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const returnTo = params.get('returnTo');
  const registerLink = returnTo ? `/register?returnTo=${encodeURIComponent(returnTo)}` : '/register';
  const forgotLink = '/forgot-password';

  useEffect(() => {
    const verifyStatus = params.get('verify');
    if (verifyStatus === 'sent') {
      setNotice('Abbiamo inviato un link di conferma. Controlla la tua email per completare la registrazione.');
    }
  }, [params]);

  const update = evt => {
    const { name, value } = evt.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const submit = async evt => {
    evt.preventDefault();
    if (loading) return;
    try {
      setLoading(true);
      
      // Add login animation class
      document.body.classList.add('auth-transitioning');
      
      const res = await client.post('/auth/login', form);
      setToken(res.data.token);
      storeUser(res.data.user);
      toast.success('Bentornato su Rivelya!');
      notifyAuthChange();
      
      // Smooth transition to target page
      setTimeout(() => {
        const target = returnTo || '/';
        navigate(target);
        
        // Remove animation class after navigation
        setTimeout(() => {
          document.body.classList.remove('auth-transitioning');
        }, 300);
      }, 200);
    } catch (error) {
      document.body.classList.remove('auth-transitioning');
      const status = error?.response?.status;
      const message = error?.response?.data?.message || 'Credenziali non valide.';
      if (status === 403) {
        setNotice(message);
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container auth-layout">
      <div className="auth-panel">
        <p className="eyebrow">Area clienti</p>
        <h1>Accedi al tuo account</h1>
        <p className="muted">
          Gestisci le tue ricariche, consulta lo storico delle sessioni e riprendi le conversazioni con i Esperti di fiducia.
        </p>
        {notice && <p className="auth-notice">{notice}</p>}
        <form className="form" onSubmit={submit}>
          <label className="input-label">
            Email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={update}
              placeholder="tuo.nome@dominio.it"
              required
            />
          </label>
          <label className="input-label">
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={update}
              placeholder="La password impostata"
              required
            />
          </label>
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Accesso in corso…' : 'Entra in Rivelya'}
          </button>
        </form>
        <div className="auth-links">
          <Link to={forgotLink} className="micro">Hai dimenticato la password?</Link>
        </div>
        <div className="auth-separator">
          <span />
          <p className="micro muted">oppure</p>
          <span />
        </div>
        <GoogleLoginButton onSuccess={() => navigate(returnTo || '/', { replace: true })} />
        <p className="muted">
          Nuovo su Rivelya? <Link to={registerLink}>Crea un account</Link>
        </p>
      </div>
      <div className="auth-sidecard">
        <div className="sidecard-headline">
          <span className="badge-soft">Accesso sicuro</span>
          <h2>Dashboard intuitiva per monitorare wallet e sessioni</h2>
        </div>
        <ul className="sidecard-list">
          <li>
            <span className="list-icon">📊</span>
            Storico chiamate e chat con dettagli di durata e costi.
          </li>
          <li>
            <span className="list-icon">💳</span>
            Ricariche rapide con Stripe e promozioni automatiche.
          </li>
          <li>
            <span className="list-icon">🤝</span>
            Team di supporto dedicato per clienti business.
          </li>
        </ul>
      </div>
    </section>
  );
}
