import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import NotificationBell from './NotificationBell.jsx';
import PageTransition from './PageTransition.jsx';
import SessionStartNotice from './SessionStartNotice.jsx';
import {
  clearAuth,
  getUser as getStoredUser,
  notifyAuthChange,
  subscribeAuthChange
} from '../lib/auth.js';

const navItems = [
  { label: 'Home', to: '/', exact: true },
  { label: 'Esperienze', to: '/experience' },
  { label: 'Esperti', to: '/catalog' },
  { label: 'Business', to: '/business' },
  { label: 'Supporto', to: '/support' }
];

const catalogNav = [
  { label: 'Tutti i master', to: '/catalog?sort=rating' },
  { label: 'Cartomanzia e Divinazione', to: '/catalog?category=cartomancy-divination' },
  { label: 'Spiritualità e Intuizione', to: '/catalog?category=spirituality-intuition' },
  { label: 'Benessere interiore e Life Coaching', to: '/catalog?category=inner-wellness-life-coaching' }
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const menuScrollRef = useRef(0);
  const wasMenuOpenRef = useRef(false);
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    const sync = () => {
      setUser(getStoredUser());
    };

    const unsubscribe = subscribeAuthChange(sync);
    return () => {
      unsubscribe();
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
    // Close menus after route changes
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const body = document.body;

    if (menuOpen) {
      menuScrollRef.current = window.scrollY;
      body.classList.add('nav-open');
      body.style.top = `-${menuScrollRef.current}px`;
    } else {
      if (wasMenuOpenRef.current) {
        body.classList.remove('nav-open');
        body.style.top = '';
        window.scrollTo(0, menuScrollRef.current);
      } else {
        body.classList.remove('nav-open');
        body.style.top = '';
      }
    }

    wasMenuOpenRef.current = menuOpen;

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
    document.body.style.top = '';
    if (menuScrollRef.current) {
      window.scrollTo(0, menuScrollRef.current);
    }
  }, []);

  useEffect(() => {
    if (!profileOpen) return undefined;

    const handlePointer = event => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
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

  const toggleMenu = () => setMenuOpen(prev => !prev);
  const closeMenu = () => setMenuOpen(false);
  const toggleProfileMenu = () => setProfileOpen(prev => !prev);
  const closeProfileMenu = () => setProfileOpen(false);

  const logout = () => {
    // Add logout animation class
    document.body.classList.add('auth-transitioning');
    
    setTimeout(() => {
      clearAuth();
      setUser(null);
      notifyAuthChange();
      navigate('/');
      
      // Remove animation class after navigation
      setTimeout(() => {
        document.body.classList.remove('auth-transitioning');
      }, 300);
    }, 150);
  };

  const activeCategory = useMemo(() => {
    if (!location.pathname.startsWith('/catalog')) return null;
    const params = new URLSearchParams(location.search);
    return params.get('category');
  }, [location.pathname, location.search]);

  const isCatalog = location.pathname.startsWith('/catalog');
  const isChat = location.pathname.startsWith('/chat') || location.pathname.startsWith('/voice');

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
    if (menuOpen) closeMenu();
  };

  // Critical fix: navigate on mousedown so the route change happens before the global mousedown closer unmounts the dropdown
  const handleProfileNavMouseDown = to => e => {
    e.preventDefault();
    e.stopPropagation();
    navigate(to);
    // Menus will close via the location effect
  };

  const authControls = user ? (
    <div className={`auth-avatar${profileOpen ? ' open' : ''}`} ref={profileRef}>
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

      {/* Stop outside-closer from eating events inside the dropdown */}
      <div
        className="auth-dropdown"
        role="menu"
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
      >
        <div className="auth-dropdown-header">
          <p className="auth-name">{user.displayName || user.email}</p>
          <p className="auth-email">{user.email}</p>
        </div>
        <div className="auth-divider" aria-hidden="true" />
        <div className="auth-dropdown-actions">
          {user?.roles?.includes('master') && (
            <Link
              to="/master/dashboard"
              role="menuitem"
              className="dropdown-link"
              onMouseDown={handleProfileNavMouseDown('/master/dashboard')}
            >
              Area Esperti
            </Link>
          )}
          <Link
            to="/reservations"
            role="menuitem"
            className="dropdown-link"
            onMouseDown={handleProfileNavMouseDown('/reservations')}
          >
            Gestione Prenotazioni
          </Link>
          <Link
            to="/chat"
            role="menuitem"
            className="dropdown-link"
            onMouseDown={handleProfileNavMouseDown('/chat')}
          >
            Chat
          </Link>
          <Link
            to="/voice"
            role="menuitem"
            className="dropdown-link"
            onMouseDown={handleProfileNavMouseDown('/voice')}
          >
            Chiamate
          </Link>
          <Link
            to="/profile"
            role="menuitem"
            className="dropdown-link"
            onMouseDown={handleProfileNavMouseDown('/profile')}
          >
            Profilo
          </Link>
          <Link
            to="/wallet"
            role="menuitem"
            className="dropdown-link"
            onMouseDown={handleProfileNavMouseDown('/wallet')}
          >
            Wallet
          </Link>
        </div>
        <button
          type="button"
          className="btn outline full-width"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            logout();
          }}
        >
          Esci
        </button>
      </div>
    </div>
  ) : (
    <div className="auth-buttons">
      <Link to="/login" className="btn ghost" onClick={handleNavClick}>
        Accedi
      </Link>
      <Link to="/register" className="btn primary" onClick={handleNavClick}>
        Inizia ora
      </Link>
    </div>
  );

  return (
    <div className={`app-shell${isChat ? ' chat-shell' : ''}`}>
      <SessionStartNotice />
      <div className="app-glow" aria-hidden="true" />
      <header className="site-header">
        <div className="container header-bar">
          <Link to="/" className="brand">
            <span className="brand-mark">Rivelya</span>
            <span className="brand-sub">Consulenze in tempo reale</span>
          </Link>
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
          <div className="header-actions">
            {user && <NotificationBell />}
            <div className="auth-actions">{authControls}</div>
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
          </div>
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
            {user && (
              <div className="mobile-nav-userbar">
                <div
                  className="mobile-user-chip"
                  role="button"
                  tabIndex={0}
                  onClick={() => { navigate('/profile'); closeMenu(); }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate('/profile');
                      closeMenu();
                    }
                  }}
                >
                  {user.avatarUrl ? (
                    <span className="chip-avatar">
                      <img src={user.avatarUrl} alt={user.displayName || user.email} />
                    </span>
                  ) : (
                    <span className="chip-avatar">{(user.displayName || user.email)?.slice(0, 2).toUpperCase()}</span>
                  )}
                  <div className="chip-meta">
                    <span className="chip-name">{user.displayName || user.email}</span>
                    <span className="chip-role">{user?.roles?.includes('master') ? 'Esperto' : 'Cliente'}</span>
                  </div>
                </div>
              </div>
            )}
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
              {/* Mobile Profile Links */}
              {user && (
                <>
                  <div className="mobile-nav-divider" />
                  {user?.roles?.includes('master') && (
                    <Link to="/master/dashboard" className="nav-link" onClick={handleNavClick}>
                      Area Esperti
                    </Link>
                  )}
                  <Link to="/reservations" className="nav-link" onClick={handleNavClick}>
                    Gestione Prenotazioni
                  </Link>
                  <Link to="/chat" className="nav-link" onClick={handleNavClick}>
                    Chat
                  </Link>
                  <Link to="/voice" className="nav-link" onClick={handleNavClick}>
                    Chiamate
                  </Link>
                  <Link to="/profile" className="nav-link" onClick={handleNavClick}>
                    Profilo
                  </Link>
                  <Link to="/wallet" className="nav-link" onClick={handleNavClick}>
                    Wallet
                  </Link>
                </>
              )}
            </nav>
            <div className="mobile-auth">
              {user ? (
                <div className="mobile-user-info">
                  <div className="mobile-user-details">
                    <p className="mobile-user-name">{user.displayName || user.email}</p>
                    <p className="mobile-user-email">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    className="btn outline mobile-logout-btn"
                    onClick={logout}
                  >
                    Esci
                  </button>
                </div>
              ) : (
                <div className="auth-buttons">
                  <Link to="/login" className="btn ghost" onClick={handleNavClick}>
                    Accedi
                  </Link>
                  <Link to="/register" className="btn primary" onClick={handleNavClick}>
                    Inizia ora
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

      </header>

      <main className={`main${isChat ? ' chat-main' : ''}`}>
        {isChat ? (
          <Outlet />
        ) : (
          <PageTransition>
            <Outlet />
          </PageTransition>
        )}
      </main>

      {!isChat && <footer className="footer">
        <div className="container footer-top">
          <div className="footer-brand">
            <p className="brand-mark">Rivelya</p>
            <p className="footer-copy">
              Consulenze guidate da esperti in cartomanzia, spiritualit? e crescita personale: sessioni trasparenti, sicure e pensate per ogni esigenza.
            </p>
          </div>
          <div className="footer-columns">
            <div>
              <p className="footer-title">Contatti</p>
              <a href="mailto:info@rivelya.com" className="footer-link">info@rivelya.com</a>
              <a href="tel:+390110243717" className="footer-link">+39 011 024 3717</a>
              <p className="footer-link">Lun–Dom· 10:00 – 20:00</p>
           
            </div>
            <div>
              <p className="footer-title">Esplora</p>
              <Link to="/catalog" className="footer-link">Catalogo Esperti</Link>
              <Link to="/experience" className="footer-link">Esperienze</Link>
              <Link to="/login" className="footer-link">Area Clienti</Link>
            </div>
            <div>
              <p className="footer-title">Per Professionisti</p>
              <Link to="/become-expert" className="footer-link">Diventa un Esperto</Link>
              <Link to="/business" className="footer-link">Business</Link>
              <Link to="/support" className="footer-link">Supporto</Link>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>{new Date().getFullYear()} Rivelya. Tutti i diritti riservati.</span>
          <div className="footer-legal">
            <Link to="/privacy" className="footer-link">Privacy</Link>
            <Link to="/cookie" className="footer-link">Cookie</Link>
            <Link to="/terms" className="footer-link">Termini</Link>
          </div>
        </div>
      </footer>}
    </div>
  );
}
