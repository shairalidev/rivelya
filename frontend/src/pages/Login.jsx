import { useState } from 'react';
import client from '../api/client.js';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const nav = useNavigate();

  const submit = async e => {
    e.preventDefault();
    const r = await client.post('/auth/login', { email, password });
    localStorage.setItem('token', r.data.token);
    nav('/');
  };

  return (
    <section className="container">
      <h2>Login</h2>
      <form onSubmit={submit} className="form">
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn" type="submit">Accedi</button>
      </form>
    </section>
  );
}
