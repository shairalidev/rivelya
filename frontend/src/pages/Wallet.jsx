import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dropin from 'braintree-web-drop-in';
import client from '../api/client.js';
import { getToken, getUser } from '../lib/auth.js';

const formatDate = iso => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Data non disponibile';
  return date.toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const channelConfig = [
  { key: 'chat', label: 'Chat', description: 'Chat', unitLabel: 'sessioni' },
  { key: 'voice', label: 'Voce', description: 'Chiamate', unitLabel: 'chiamate' },
  { key: 'chat_voice', label: 'Chat + Voce', description: 'Chat e Voce', unitLabel: 'sessioni' }
];

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2
});

const formatCurrency = cents => currencyFormatter.format((cents || 0) / 100);

export default function Wallet() {
  const navigate = useNavigate();
  const [data, setData] = useState({ balance_cents: 0, ledger: [], currency: 'EUR' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testAmount, setTestAmount] = useState('2000');
  const [testCard, setTestCard] = useState('4242 4242 4242 4242');
  const [testLoading, setTestLoading] = useState(false);
  const [masterStats, setMasterStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [recentEarnings, setRecentEarnings] = useState([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [btInstance, setBtInstance] = useState(null);
  const [btLoading, setBtLoading] = useState(false);
  const [btAmount, setBtAmount] = useState('10');
  const [btError, setBtError] = useState('');
  const dropInRef = useRef(null);
  const user = getUser();
  const isMaster = Boolean(user?.roles?.includes('master'));

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

  useEffect(() => {
    if (!isMaster) return undefined;
    let active = true;
    setStatsLoading(true);
    setEarningsLoading(true);
    
    Promise.all([
      client.get('/wallet/master/monthly-stats'),
      client.get('/wallet/master/recent-earnings')
    ])
      .then(([statsRes, earningsRes]) => {
        if (!active) return;
        setMasterStats(statsRes.data);
        setRecentEarnings(earningsRes.data.transactions || []);
        setStatsError('');
      })
      .catch(() => {
        if (!active) return;
        setStatsError('Impossibile recuperare i dati del master.');
      })
      .finally(() => {
        if (!active) return;
        setStatsLoading(false);
        setEarningsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isMaster]);

  useEffect(() => {
    if (isMaster) return undefined;
    let active = true;
    let instance;

    const setup = async () => {
      try {
        setBtLoading(true);
        setBtError('');
        const tokenRes = await client.post('/wallet/braintree/token');
        if (!active) return;
        instance = await dropin.create({
          authorization: tokenRes.data.clientToken,
          container: dropInRef.current,
          translations: 'it_IT',
          // Card-only flow to avoid PayPal SDK calls blocked by some ad blockers
          paymentOptionPriority: ['card'],
          card: { cardholderName: true }
        });
        if (active) setBtInstance(instance);
      } catch (err) {
        if (!active) return;
        const blockedByClient = /blocked_by_client/i.test(err?.message || '');
        const message = blockedByClient
          ? 'Sblocca PayPal/Braintree sul tuo ad blocker per abilitare il pagamento.'
          : err?.response?.data?.message || 'Impossibile inizializzare il pagamento.';
        setBtError(message);
        toast.error(message);
      } finally {
        if (active) setBtLoading(false);
      }
    };

    setup();

    return () => {
      active = false;
      if (instance?.teardown) instance.teardown();
    };
  }, [isMaster]);

  const topup = async amount => {
    if (!btInstance) {
      toast.error('Pagamento non pronto, ricarica la pagina.');
      return;
    }
    const cents = Math.round(Number(amount) * 100);
    if (!cents || cents <= 0) {
      toast.error('Inserisci un importo valido.');
      return;
    }
    try {
      setBtLoading(true);
      const payload = await btInstance.requestPaymentMethod();
      const res = await client.post('/wallet/braintree/checkout', {
        amount_cents: cents,
        payment_method_nonce: payload.nonce
      });
      setData(prev => ({
        ...prev,
        balance_cents: res.data.balance_cents,
        ledger: [res.data.transaction, ...(prev.ledger || [])]
      }));
      toast.success('Ricarica completata.');
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Impossibile completare la ricarica.';
      toast.error(message);
    } finally {
      setBtLoading(false);
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
  const monthLabel = masterStats
    ? new Date(Date.UTC(masterStats.year, (masterStats.month || 1) - 1, 1)).toLocaleString('it-IT', {
      month: 'long',
      year: 'numeric'
    })
    : '';
  const totals = masterStats?.totals || { count: 0, minutes: 0, earnings_cents: 0 };

  return (
    <section className="container wallet">
      <div className="section-head">
        <span className="badge-soft">Wallet</span>
        <h1>Gestisci il tuo credito</h1>
        <p className="muted">Ricariche rapide, promozioni automatiche e storico movimenti trasparente.</p>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="wallet-rows">
        <div className="wallet-summary" style={{ marginBottom: '2rem' }}>
          <p>Saldo disponibile</p>
          <h2>{balance} €</h2>
          <p className="muted">Valuta: {data.currency || 'EUR'}</p>
          {!isMaster && (
            <>
              <div className="wallet-actions">
                <label className="input-label" style={{ minWidth: '140px' }}>
                  Importo (EUR)
                  <input
                    type="number"
                    min="5"
                    step="1"
                    value={btAmount}
                    onChange={evt => setBtAmount(evt.target.value)}
                  />
                </label>
                <button className="btn primary" onClick={() => topup(btAmount)} disabled={btLoading || !btInstance}>
                  {btLoading ? 'Elaborazione...' : 'Paga con carta'}
                </button>
                <button className="btn outline" type="button" onClick={() => setBtAmount('10')}>10 €</button>
                <button className="btn outline" type="button" onClick={() => setBtAmount('30')}>30 €</button>
                <button className="btn outline" type="button" onClick={() => setBtAmount('50')}>50 €</button>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <div ref={dropInRef} />
                {btError && <p className="micro danger" style={{ marginTop: '0.5rem' }}>{btError}</p>}
              </div>
              <p className="micro">Pagamenti sicuri con Braintree. Il saldo si aggiorna dopo l'autorizzazione.</p>
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
            </>
          )}
          {isMaster && (
            <p className="micro">Il tuo saldo rappresenta i guadagni dalle sessioni completate (30% delle tariffe).</p>
          )}
        </div>

        {!isMaster && (
          <div className="wallet-ledger" style={{ marginBottom: '2rem' }}>
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
        )}

        {isMaster && (
          <div className="wallet-master-panel" style={{ marginBottom: '2rem' }}>
            <div className="wallet-master-head">
              <div>
                <span className="badge-soft">Riepilogo master</span>
                <h3>Sessioni e Guadagni - {monthLabel || 'Mese corrente'}</h3>
              </div>
            </div>
            {statsLoading ? (
              <div className="skeleton-list metrics-skeleton">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="skeleton-item" style={{ height: '72px' }} />
                ))}
              </div>
            ) : statsError ? (
              <div className="alert">{statsError}</div>
            ) : (
              <>
                <div className="wallet-master-table-wrapper">
                  <table className="wallet-master-table">
                    <thead>
                      <tr>
                        <th>Canale</th>
                        <th>Sessioni</th>
                        <th>Minuti</th>
                        <th>Guadagni (30%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channelConfig.map(channel => {
                        const values = masterStats?.stats?.[channel.key] || { count: 0, minutes: 0, earnings_cents: 0 };
                        return (
                          <tr key={channel.key}>
                            <td>
                              <div className="wallet-master-channel">
                                <strong>{channel.description}</strong>
                                <span className="muted">{channel.label}</span>
                              </div>
                            </td>
                            <td>
                              <span className="wallet-master-number">{values.count}</span>
                              <span className="wallet-master-caption">{channel.unitLabel}</span>
                            </td>
                            <td>
                              <span className="wallet-master-number">{values.minutes}</span>
                              <span className="wallet-master-caption">minuti</span>
                            </td>
                            <td className="wallet-master-earnings">{formatCurrency(values.earnings_cents)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="wallet-master-total">
                  <div>
                    <p className="muted">Totale guadagni mensili</p>
                    <h4>{formatCurrency(totals.earnings_cents)}</h4>
                  </div>
                  <p className="micro">
                    {totals.minutes} minuti · {totals.count} sessioni totali
                  </p>
                </div>

              </>
            )}
          </div>
        )}

        {isMaster && (
          <div className="wallet-ledger" style={{ marginBottom: '2rem' }}>
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
        )}
      </div>
    </section>
  );
}
