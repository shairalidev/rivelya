import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import client from '../api/client.js';

export default function MasterProfile() {
  const { id } = useParams();
  const [master, setMaster] = useState(null);

  useEffect(() => {
    // quick fetch through catalog endpoint for demo
    client.get('/catalog', { params: {} }).then(r => {
      setMaster(r.data.find(x => x._id === id) || null);
    });
  }, [id]);

  if (!master) return <div className="container">Loading...</div>;

  const call = async () => {
    const r = await client.post('/session/phone', { master_id: master._id });
    alert(`Session created: ${r.data.session_id}`);
  };

  const chat = async () => {
    const r = await client.post('/session/chat', { master_id: master._id });
    alert(`Chat session: ${r.data.session_id}`);
  };

  return (
    <section className="container">
      <h2>Master</h2>
      <img src={master.media?.avatar_url || 'https://placehold.co/240'} alt="" />
      <p>{master.bio || '—'}</p>
      <p>Tariffe: Tel {(master.rate_phone_cpm/100).toFixed(2)} €/min, Chat {(master.rate_chat_cpm/100).toFixed(2)} €/min</p>
      <div className="actions">
        <button className="btn" onClick={call}>Chiama</button>
        <button className="btn" onClick={chat}>Chat</button>
      </div>
    </section>
  );
}
