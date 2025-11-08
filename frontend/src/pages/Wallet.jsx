import { useEffect, useState } from 'react';
import client from '../api/client.js';

export default function Wallet() {
  const [data, setData] = useState({ balance_cents: 0, ledger: [] });

  useEffect(() => {
    client.get('/wallet/ledger').then(r => setData(r.data)).catch(()=>{});
  }, []);

  const topup = async amount => {
    const r = await client.post('/wallet/topup', { provider: 'stripe', amount_cents: amount });
    if (r.data.url) window.location = r.data.url;
  };

  return (
    <section className="container">
      <h2>Wallet</h2>
      <p>Saldo: {(data.balance_cents/100).toFixed(2)} €</p>
      <div className="actions">
        <button className="btn" onClick={()=>topup(1000)}>Ricarica 10€</button>
        <button className="btn" onClick={()=>topup(3000)}>Ricarica 30€</button>
        <button className="btn" onClick={()=>topup(5000)}>Ricarica 50€</button>
      </div>
      <h3>Movimenti</h3>
      <ul className="list">
        {data.ledger.map(l => (
          <li key={l._id}>{l.type} {(l.amount/100).toFixed(2)} €</li>
        ))}
      </ul>
    </section>
  );
}
