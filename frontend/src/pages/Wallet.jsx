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
const quickAmounts = [10, 30, 50];

export default function Wallet() {
  const navigate = useNavigate();
  const [data, setData] = useState({ balance_cents: 0, ledger: [], currency: 'EUR' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [masterStats, setMasterStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [recentEarnings, setRecentEarnings] = useState([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [btInstance, setBtInstance] = useState(null);
  const [btLoading, setBtLoading] = useState(false);
  const [btAmount, setBtAmount] = useState('10');
  const [btError, setBtError] = useState('');
  const [showDropin, setShowDropin] = useState(false);
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
    if (isMaster || !showDropin) return undefined;
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
          paymentOptionPriority: ['card'],
          card: {
            cardholderName: true,
            overrides: {
              styles: {
                input: {
                  color: '#f6f8ff',
                  'font-family': '\'Manrope\', system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif',
                  'font-size': '16px',
                  'line-height': '22px',
                  'letter-spacing': '0.02em'
                },
                ':focus': {
                  color: '#ffffff',
                  'box-shadow': '0 0 0 2px rgba(109, 91, 255, 0.5)'
                },
                '::placeholder': {
                  color: 'rgba(246, 248, 255, 0.7)'
                },
                '.invalid': {
                  color: '#ff7b7b'
                },
                '.valid': {
                  color: '#3dd8b6'
                }
              }
            }
          }
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
      setBtInstance(null);
    };
  }, [isMaster, showDropin]);

  const topup = async amount => {
    if (!btInstance) {
      toast.error('Apri prima il pagamento Braintree.');
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

  const balanceValue = ((data.balance_cents || 0) / 100).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const monthLabel = masterStats
    ? new Date(Date.UTC(masterStats.year, (masterStats.month || 1) - 1, 1)).toLocaleString('it-IT', {
      month: 'long',
      year: 'numeric'
    })
    : '';
  const totals = masterStats?.totals || { count: 0, minutes: 0, earnings_cents: 0 };
  const ledgerEntries = Array.isArray(data.ledger) ? data.ledger : [];

  return (
    <section className="container wallet">
      <div className="section-head">
        <span className="badge-soft">Wallet</span>
        <h1>Gestisci il tuo credito</h1>
        <p className="muted">Ricariche rapide, promozioni automatiche e storico movimenti trasparente.</p>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="wallet-layout">
        <div className="wallet-main">
          <div className="wallet-summary-card wallet-card">
            <div className="wallet-card-head">
              <div>
                <p className="micro">Saldo disponibile</p>
                <h2 className="wallet-balance-amount">
                  <span className="currency">€</span>
                  <span>{balanceValue}</span>
                </h2>
                <p className="muted">Valuta: {data.currency || 'EUR'}</p>
              </div>
              <div className="wallet-badge">
                <span className="pill">Rivelya</span>
              </div>
            </div>
            {!isMaster && (
              <div className="wallet-quick-amounts">
                {quickAmounts.map(amount => (
                  <button
                    key={amount}
                    className={`pill ${Number(btAmount) === amount ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      setBtAmount(String(amount));
                      setShowDropin(true);
                    }}
                  >
                    + {amount} €
                  </button>
                ))}
              </div>
            )}
            {isMaster && (
              <p className="micro">Il tuo saldo rappresenta i guadagni dalle sessioni completate (30% delle tariffe).</p>
            )}
          </div>

          {!isMaster && (
            <div className="wallet-payment-card wallet-card">
              <div className="wallet-card-head">
                <div>
                  <p className="micro">Ricarica con carta</p>
                  <h3>Pagamento Braintree protetto</h3>
                  <p className="muted">Apriamo il modulo di pagamento inline, senza reindirizzamenti.</p>
                </div>
                <span className="pill badge-soft">PCI-DSS</span>
              </div>
              <div className="wallet-payment-grid">
                <label className="input-label">
                  Importo (EUR)
                  <input
                    type="number"
                    min="5"
                    step="1"
                    value={btAmount}
                    onChange={evt => setBtAmount(evt.target.value)}
                  />
                </label>
                <div className="wallet-quick-amounts compact">
                  {quickAmounts.map(amount => (
                    <button
                      key={amount}
                      className={`pill ${Number(btAmount) === amount ? 'active' : ''}`}
                      type="button"
                      onClick={() => {
                        setBtAmount(String(amount));
                        setShowDropin(true);
                      }}
                    >
                      {amount} €
                    </button>
                  ))}
                </div>
              </div>
              <div className="wallet-dropin-shell">
                {!showDropin ? (
                  <div className="wallet-dropin-placeholder">
                    <div>
                      <p className="ledger-title" style={{ margin: 0 }}>Aggiungi i dati della carta</p>
                      <p className="muted micro">Il form appare qui sotto in un contenitore sicuro di Braintree.</p>
                    </div>
                    <div className="wallet-payment-actions">
                      <button
                        className="btn primary"
                        type="button"
                        onClick={() => setShowDropin(true)}
                        disabled={btLoading}
                      >
                        {btLoading ? 'Preparazione...' : 'Apri il form carta'}
                      </button>
                      <button className="btn ghost" type="button" onClick={() => setBtAmount('10')}>Reimposta a 10 €</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="wallet-dropin-head">
                      <div>
                        <p className="ledger-title" style={{ margin: 0 }}>Inserisci i dati della carta</p>
                        <p className="micro muted">Visa, Mastercard, Amex. Il form A8 ospitato da Braintree e cifrato.</p>
                      </div>
                      <div className="wallet-card-brands">
                        <span>VISA</span>
                        <span>MC</span>
                        <span>AMEX</span>
                      </div>
                    </div>
                    <div className="wallet-dropin-container" ref={dropInRef} />
                    {btError && <p className="micro danger" style={{ marginTop: '0.5rem' }}>{btError}</p>}
                    <div className="wallet-payment-actions">
                      <button
                        className="btn primary"
                        onClick={() => topup(btAmount)}
                        disabled={btLoading || !btInstance}
                      >
                        {btLoading ? 'Elaborazione...' : `Ricarica ${btAmount || 0} €`}
                      </button>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => {
                          setShowDropin(false);
                          setBtError('');
                        }}
                        disabled={btLoading}
                      >
                        Chiudi modulo
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="wallet-side">
          <div className="wallet-ledger wallet-card">
            <div className="wallet-card-head">
              <div>
                <p className="micro">Movimenti recenti</p>
                <h3>Transazioni {isMaster ? 'master' : 'wallet'}</h3>
              </div>
            </div>
            {loading ? (
              <div className="skeleton-list">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="skeleton-item" />
                ))}
              </div>
            ) : ledgerEntries.length === 0 ? (
              <p className="muted">Nessuna transazione disponibile.</p>
            ) : (
              <ul className="ledger-list">
                {ledgerEntries.map(entry => (
                  <li key={entry._id} className={`ledger-item ${entry.type}`}>
                    <div>
                      <p className="ledger-title">{entry.meta?.description || entry.meta?.master || entry.type}</p>
                      <p className="muted">
                        {formatDate(entry.createdAt)}
                        {entry.meta?.master ? ` - ${entry.meta.master}` : ''}
                        {entry.meta?.channel ? ` - ${entry.meta.channel}` : ''}
                      </p>
                    </div>
                    <span className="ledger-amount">{formatCurrency(entry.amount_cents ?? entry.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {isMaster && (
        <div className="wallet-master-grid">
          <div className="wallet-master-panel">
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
                    {totals.minutes} minuti - {totals.count} sessioni totali
                  </p>
                </div>

              </>
            )}
          </div>

          <div className="wallet-card wallet-earnings-card">
            <div className="wallet-card-head">
              <div>
                <p className="micro">Ultimi accrediti</p>
                <h3>Pagamenti recenti</h3>
              </div>
              <span className="pill badge-soft">Live</span>
            </div>
            {earningsLoading ? (
              <div className="skeleton-list">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="skeleton-item" />
                ))}
              </div>
            ) : recentEarnings.length === 0 ? (
              <p className="muted">Ancora nessun accredito registrato.</p>
            ) : (
              <ul className="wallet-earnings-list">
                {recentEarnings.map(tx => (
                  <li key={tx._id} className="wallet-earning">
                    <div>
                      <p className="ledger-title">{tx.meta?.master || tx.meta?.description || 'Pagamento'}</p>
                      <p className="micro muted">
                        {formatDate(tx.createdAt)}
                        {tx.meta?.channel ? ` - ${tx.meta.channel}` : ''}
                      </p>
                    </div>
                    <span className="wallet-earning-amount">{formatCurrency(tx.amount_cents ?? tx.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
