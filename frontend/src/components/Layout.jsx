import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';

const navItems = [
  { label: 'Esperienza', to: '/', exact: true },
  { label: 'Master', to: '/catalog' },
  { label: 'Business', to: '/#business', anchor: true },
  { label: 'Supporto', to: '/#supporto', anchor: true }
];

const catalogNav = [
  { label: 'Tutti i master', to: '/catalog?sort=rating' },
  { label: 'Cartomanzia', to: '/catalog?category=cartomanzia' },
  { label: 'Legale', to: '/catalog?category=legale' },
  { label: 'Coaching', to: '/catalog?category=coaching' },
  { label: 'Benessere', to: '/catalog?category=benessere' }
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const desktopProfileRef = useRef(null);
  const mobileProfileRef = useRef(null);
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
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen);

    if (!menuOpen) return undefined;

    const onKeyDown = event => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => () => {
    document.body.classList.remove('nav-open');
  }, []);

  useEffect(() => {
    if (!profileOpen) return undefined;

    const handlePointer = event => {
      const desktopContains = desktopProfileRef.current?.contains(event.target);
      const mobileContains = mobileProfileRef.current?.contains(event.target);

      if (!desktopContains && !mobileContains) {
        setProfileOpen(false);
      }
    };

    const handleKey = event => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('touchstart', handlePointer);
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('touchstart', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [profileOpen]);

  const toggleMenu = () => {
    setMenuOpen(prev => !prev);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const toggleProfileMenu = () => {
    setProfileOpen(prev => !prev);
  };

  const closeProfileMenu = () => {
    setProfileOpen(false);
  };

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

  const isCatalog = location.pathname.startsWith('/catalog');

  const isChipActive = item => {
    if (!isCatalog) return false;
    const query = item.to.includes('?') ? new URLSearchParams(item.to.split('?')[1]) : new URLSearchParams();
    const category = query.get('category');
    if (category) return activeCategory === category;
    const sort = query.get('sort');
    if (sort === 'rating') return !activeCategory;
    return false;
  };

  const handleNavClick = () => {
    if (menuOpen) {
      closeMenu();
    }
  };

  const handleProfileNavigation = to => {
    closeMenu();
    closeProfileMenu();
    navigate(to);
  };

  const handleLogout = () => {
    logout();
    closeMenu();
    closeProfileMenu();
  };

  const renderAuthControls = ref =>
    user ? (
      <AuthDropdown
        ref={ref}
        user={user}
        profileOpen={profileOpen}
        toggleProfileMenu={toggleProfileMenu}
        onNavigate={handleProfileNavigation}
        onLogout={handleLogout}
      />
    ) : (
      <AuthButtons onNavClick={handleNavClick} />
    );

  return (
    <div className="app-shell">
      <div className="app-glow" aria-hidden="true" />
      <header className="site-header">
        <div className="container header-bar">
          <Link to="/" className="brand">
            <span className="brand-mark">Rivelya</span>
            <span className="brand-sub">Consulenze in tempo reale</span>
          </Link>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={toggleMenu}
          >
            <span className="menu-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="menu-label">Menu</span>
          </button>
          <nav className="primary-nav">
            {navItems.map(item =>
              item.anchor ? (
                <Link key={item.label} to={item.to} className="nav-link" onClick={handleNavClick}>
                  {item.label}
                </Link>
              ) : (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  onClick={handleNavClick}
                >
                  {item.label}
                </NavLink>
              )
            )}
          </nav>
          <div className="auth-actions">{renderAuthControls(desktopProfileRef)}</div>
        </div>
        <div className={`mobile-nav${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
          <div className="mobile-nav-backdrop" onClick={closeMenu} role="presentation" />
          <div
            className="mobile-nav-panel"
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-nav-title"
          >
            <div className="mobile-nav-header">
              <p className="mobile-nav-title" id="mobile-nav-title">Navigazione</p>
              <button type="button" className="menu-close" onClick={closeMenu} aria-label="Chiudi menu">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <nav className="mobile-nav-links">
              {navItems.map(item =>
                item.anchor ? (
                  <Link key={item.label} to={item.to} className="nav-link" onClick={handleNavClick}>
                    {item.label}
                  </Link>
                ) : (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    onClick={handleNavClick}
                  >
                    {item.label}
                  </NavLink>
                )
              )}
            </nav>
            <div className="mobile-auth">{renderAuthControls(mobileProfileRef)}</div>
          </div>
        </div>
        {isCatalog && (
          <div className="container subnav-wrapper">
            <div className="subnav">
              <span className="subnav-label">Catalogo</span>
              <div className="subnav-links">
                {catalogNav.map(item => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={`subnav-chip${isChipActive(item) ? ' active' : ''}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-top">
          <div className="footer-brand">
            <p className="brand-mark">Rivelya</p>
            <p className="footer-copy">
              Una piattaforma curata di consulenti certificati in cartomanzia, legale, coaching e benessere. Sessioni immediate, trasparenti e sicure.
            </p>
            <p className="footer-copy">Sede operativa: Via Monte Napoleone 8, Milano</p>
          </div>
          <div className="footer-columns">
            <div>
              <p className="footer-title">Contatti</p>
              <a href="mailto:hello@rivelya.com" className="footer-link">hello@rivelya.com</a>
              <a href="tel:+390212345678" className="footer-link">+39 02 1234 5678</a>
              <p className="footer-link">Lun-Dom · 8:00 - 22:00</p>
            </div>
            <div>
              <p className="footer-title">Piattaforma</p>
              <Link to="/catalog" className="footer-link">Catalogo Master</Link>
              <Link to="/login" className="footer-link">Area clienti</Link>
              <Link to="/register" className="footer-link">Diventa cliente</Link>
            </div>
            <div>
              <p className="footer-title">Risorse</p>
              <a href="#" className="footer-link">Supporto</a>
              <a href="#" className="footer-link">Diventa master</a>
              <a href="#" className="footer-link">Press kit</a>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
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

const AuthDropdown = forwardRef(function AuthDropdown(
  { user, profileOpen, toggleProfileMenu, onNavigate, onLogout },
  ref
) {
  return (
    <div className={`auth-avatar${profileOpen ? ' open' : ''}`} ref={ref}>
      <button
        type="button"
        className="avatar-trigger"
        aria-haspopup="true"
        aria-expanded={profileOpen}
        aria-label="Menu utente"
        onClick={toggleProfileMenu}
      >
        {user.avatarUrl ? (
          <span className="avatar-circle avatar-image">
            <img src={user.avatarUrl} alt={user.displayName || user.email} />
          </span>
        ) : (
          <span className="avatar-circle">{(user.displayName || user.email)?.slice(0, 2).toUpperCase()}</span>
        )}
        <span className="avatar-caret" aria-hidden="true" />
      </button>
      <div className="auth-dropdown" role="menu">
        <div className="auth-dropdown-header">
          <p className="auth-name">{user.displayName || user.email}</p>
          <p className="auth-email">{user.email}</p>
        </div>
        <div className="auth-divider" aria-hidden="true" />
        <div className="auth-dropdown-actions">
          <Link to="/profile" role="menuitem" className="dropdown-link" onClick={() => onNavigate('/profile')}>
            Profilo
          </Link>
          <Link to="/wallet" role="menuitem" className="dropdown-link" onClick={() => onNavigate('/wallet')}>
            Wallet
          </Link>
          <Link to="/settings" role="menuitem" className="dropdown-link" onClick={() => onNavigate('/settings')}>
            Impostazioni
          </Link>
        </div>
        <button type="button" className="btn outline full-width" onClick={onLogout}>
          Esci
        </button>
      </div>
    </div>
  );
});

function AuthButtons({ onNavClick }) {
  return (
    <div className="auth-buttons">
      <Link to="/login" className="btn ghost" onClick={onNavClick}>
        Accedi
      </Link>
      <Link to="/register" className="btn primary" onClick={onNavClick}>
        Inizia ora
      </Link>
    </div>
  );
}
