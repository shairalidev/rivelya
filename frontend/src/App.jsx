import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import Login from './pages/Login.jsx';
import Wallet from './pages/Wallet.jsx';
import MasterProfile from './pages/MasterProfile.jsx';

export default function App() {
  return (
    <>
      <nav className="nav">
        <Link to="/">Rivelya</Link>
        <Link to="/catalog?category=cartomanzia">Cartomanzia</Link>
        <Link to="/catalog?category=legale">Legale</Link>
        <Link to="/catalog?category=coaching">Coaching</Link>
        <Link to="/wallet">Wallet</Link>
        <Link to="/login">Login</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/masters/:id" element={<MasterProfile />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
