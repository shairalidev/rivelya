import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

const navItems = [
  { label: 'Esperienza', to: '/', exact: true },
  { label: 'Master', to: '/catalog' },
  { label: 'Business', to: '/#business', anchor: true },
  { label: 'Supporto', to: '/#supporto', anchor: true }
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('Unable to parse stored user', err);
      return null;
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem('user');
        setUser(raw ? JSON.parse(raw) : null);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener('storage', sync);
    window.addEventListener('rivelya-auth-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('rivelya-auth-change', sync);
    };
  }, []);

  useEffect(() => {
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname, location.hash]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('rivelya-auth-change'));
    navigate('/');
  };

  const activeCategory = useMemo(() => {
    if (!location.pathname.startsWith('/catalog')) return null;
    const params = new URLSearchParams(location.search);
    return params.get('category');
  }, [location.pathname, location.search]);

  return (
    <div className="app-shell">
      <div className="app-glow" aria-hidden="true" />
      <header className="header container">
        <Link to="/" className="brand">
          <span className="brand-mark">Rivelya</span>
          <span className="brand-sub">Consulenze in tempo reale</span>
        </Link>
        <nav className="nav-links">
          {navItems.map(item =>
            item.anchor ? (
              <Link key={item.label} to={item.to} className="nav-link">
                {item.label}
              </Link>
            ) : (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.exact}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            )
          )}
        </nav>
        <div className="nav-actions">
          <Link
            to="/catalog?sort=rating"
            className={`nav-chip${location.pathname.startsWith('/catalog') && !activeCategory ? ' active' : ''}`}
          >
            Tutti i Master
          </Link>
          <Link
            to="/catalog?category=cartomanzia"
            className={`nav-chip${activeCategory === 'cartomanzia' ? ' active' : ''}`}
          >
            Cartomanzia
          </Link>
          <Link
            to="/catalog?category=legale"
            className={`nav-chip${activeCategory === 'legale' ? ' active' : ''}`}
          >
            Legale
          </Link>
          <Link
            to="/catalog?category=coaching"
            className={`nav-chip${activeCategory === 'coaching' ? ' active' : ''}`}
          >
            Coaching
          </Link>
        </div>
        <div className="auth-actions">
          {user ? (
            <div className="auth-avatar">
              <span className="avatar-circle">{user.email?.slice(0, 2).toUpperCase()}</span>
              <div className="auth-dropdown">
                <p className="auth-email">{user.email}</p>
                <div className="auth-buttons">
                  <Link to="/wallet" className="btn ghost">Wallet</Link>
                  <button type="button" className="btn outline" onClick={logout}>Esci</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn ghost">Accedi</Link>
              <Link to="/register" className="btn primary">Inizia ora</Link>
            </div>
          )}
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <p className="brand-mark">Rivelya</p>
            <p className="footer-copy">Professionisti selezionati per consulenze immediate in ambito cartomanzia, legale, coaching e benessere.</p>
          </div>
          <div>
            <p className="footer-title">Contatti</p>
            <p className="footer-link">hello@rivelya.com</p>
            <p className="footer-link">+39 02 1234 5678</p>
          </div>
          <div>
            <p className="footer-title">Risorse</p>
            <Link to="/catalog" className="footer-link">Catalogo Master</Link>
            <Link to="/login" className="footer-link">Area clienti</Link>
            <Link to="/register" className="footer-link">Diventa cliente</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Rivelya. Tutti i diritti riservati.</span>
          <div className="footer-legal">
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Cookie</a>
            <a href="#" className="footer-link">Termini</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
