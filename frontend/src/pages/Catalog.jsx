import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import client from '../api/client.js';

export default function Catalog() {
  const [data, setData] = useState([]);
  const [params] = useSearchParams();
  const category = params.get('category') || '';

  useEffect(() => {
    client.get('/catalog', { params: { category, sort: 'rating' } })
      .then(r => setData(r.data))
      .catch(() => setData([]));
  }, [category]);

  return (
    <section className="container">
      <h2>Catalogo {category}</h2>
      <div className="grid">
        {data.map((m, i) => (
          <div key={i} className="card">
            <img src={m.media?.avatar_url || 'https://placehold.co/200'} alt="" />
            <div className="card-body">
              <div className="title">Rating {m.kpis?.avg_rating?.toFixed?.(1) || 'N/A'}</div>
              <div className="muted">{m.availability}</div>
              <div className="price">Tel: {(m.rate_phone_cpm/100).toFixed(2)} €/min</div>
              <div className="price">Chat: {(m.rate_chat_cpm/100).toFixed(2)} €/min</div>
              <div className="actions">
                <Link to={`/masters/${m._id}`} className="btn">Dettagli</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
