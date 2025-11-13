import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client.js';
import { notifyAuthChange, setToken, setUser as storeUser } from '../lib/auth.js';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('info');
      setMessage('Controlla la tua casella email e clicca sul link di verifica per attivare il tuo account.');
      return;
    }

    const verify = async () => {
      try {
        setStatus('loading');
        const res = await client.get(`/auth/verify-email/${token}`);
        setToken(res.data.token);
        storeUser(res.data.user);
        notifyAuthChange();
        setStatus('success');
        setMessage('Email verificata con successo! Stiamo preparando la tua area personale…');
        toast.success('Benvenuto in Rivelya!');
        setTimeout(() => navigate('/profile', { replace: true }), 1800);
      } catch (error) {
        setStatus('error');
        const msg = error?.response?.data?.message || 'Link non valido o scaduto. Richiedi una nuova verifica.';
        setMessage(msg);
      }
    };

    verify();
  }, [params, navigate]);

  return (
    <section className="container verify">
      <div className="verify-card">
        <p className="eyebrow">Verifica email</p>
        <h1>Conferma il tuo indirizzo</h1>
        <p className="muted">{message}</p>
        {status === 'loading' && <div className="loader" aria-hidden="true" />}
        {status === 'success' && (
          <p className="muted">Verrai reindirizzato automaticamente. Se non accade, <Link to="/profile">vai alla tua area personale</Link>.</p>
        )}
        {status === 'error' && (
          <div className="verify-actions">
            <Link to="/register" className="btn primary">Richiedi nuovo link</Link>
            <Link to="/login" className="btn ghost">Accedi</Link>
          </div>
        )}
        {status === 'info' && (
          <div className="verify-actions">
            <Link to="/login" className="btn primary">Ho già verificato</Link>
            <Link to="/register" className="btn ghost">Invia di nuovo</Link>
          </div>
        )}
      </div>
    </section>
  );
}
