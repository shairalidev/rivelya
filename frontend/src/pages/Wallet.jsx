import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client.js';
import { getToken } from '../lib/auth.js';

const formatDate = iso => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Data non disponibile';
  return date.toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

export default function Wallet() {
  const navigate = useNavigate();
  const [data, setData] = useState({ balance_cents: 0, ledger: [], currency: 'EUR' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testAmount, setTestAmount] = useState('2000');
  const [testCard, setTestCard] = useState('4242 4242 4242 4242');
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      toast.error('Accedi per visualizzare il tuo wallet.');
      navigate('/login?returnTo=/wallet');
      return;
    }
    client.get('/wallet/ledger')
      .then(res => {
        setData(res.data);
        setError('');
      })
      .catch(() => {
        setError('Impossibile recuperare il wallet in questo momento.');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const topup = async amount => {
    try {
      const res = await client.post('/wallet/topup', { provider: 'stripe', amount_cents: amount });
      toast.success('Ricarica creata, verrai reindirizzato al pagamento.');
      if (res.data.url) window.location = res.data.url;
    } catch (error) {
      const message = error?.response?.data?.message || 'Impossibile creare la ricarica.';
      toast.error(message);
    }
  };

  const testTopup = async evt => {
    evt.preventDefault();
    try {
      setTestLoading(true);
      const res = await client.post('/wallet/test-topup', {
        card_number: testCard,
        amount_cents: Number(testAmount)
      });
      setData(prev => ({
        ...prev,
        balance_cents: res.data.balance_cents,
        ledger: [res.data.transaction, ...prev.ledger]
      }));
      toast.success('Ricarica di test completata.');
    } catch (err) {
      const message = err?.response?.data?.message || 'Impossibile completare la ricarica di test.';
      toast.error(message);
    } finally {
      setTestLoading(false);
    }
  };

  const balance = (data.balance_cents / 100).toFixed(2);

  return (
    <section className="container wallet">
      <div className="section-head">
        <span className="badge-soft">Wallet</span>
        <h1>Gestisci il tuo credito</h1>
        <p className="muted">Ricariche rapide, promozioni automatiche e storico movimenti trasparente.</p>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="wallet-grid">
        <div className="wallet-summary">
          <p>Saldo disponibile</p>
          <h2>{balance} €</h2>
          <p className="muted">Valuta: {data.currency || 'EUR'}</p>
          <div className="wallet-actions">
            <button className="btn primary" onClick={() => topup(1000)}>Ricarica 10 €</button>
            <button className="btn outline" onClick={() => topup(3000)}>Ricarica 30 €</button>
            <button className="btn outline" onClick={() => topup(5000)}>Ricarica 50 €</button>
          </div>
          <p className="micro">Ogni ricarica include ricevuta fiscale e aggiornamento istantaneo del saldo.</p>
          <form className="test-topup" onSubmit={testTopup}>
            <p className="micro">Ricarica di test (usa la carta 4242 4242 4242 4242)</p>
            <div className="test-grid">
              <label className="input-label">
                Numero carta
                <input value={testCard} onChange={evt => setTestCard(evt.target.value)} placeholder="4242 4242 4242 4242" />
              </label>
              <label className="input-label">
                Importo (cent)
                <input value={testAmount} onChange={evt => setTestAmount(evt.target.value)} type="number" min="100" step="100" />
              </label>
            </div>
            <button type="submit" className="btn outline" disabled={testLoading}>
              {testLoading ? 'Caricamento…' : 'Aggiungi credito di test'}
            </button>
          </form>
        </div>

        <div className="wallet-ledger">
          <h3>Movimenti recenti</h3>
          {loading ? (
            <div className="skeleton-list">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="skeleton-item" />
              ))}
            </div>
          ) : (
            <ul className="ledger-list">
              {data.ledger.map(entry => (
                <li key={entry._id} className={`ledger-item ${entry.type}`}>
                  <div>
                    <p className="ledger-title">{entry.meta?.description || entry.meta?.master || entry.type}</p>
                    <p className="muted">
                      {formatDate(entry.createdAt)}
                      {entry.meta?.master ? ` · ${entry.meta.master}` : ''}
                      {entry.meta?.channel ? ` · ${entry.meta.channel}` : ''}
                    </p>
                  </div>
                  <span className="ledger-amount">{(entry.amount / 100).toFixed(2)} €</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
