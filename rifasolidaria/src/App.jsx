import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DatabaseProvider } from './context/DatabaseContext';
import { Home } from './views/Home';
import { Dashboard } from './views/Dashboard';
import { CreateRaffle } from './views/CreateRaffle';
import { RaffleDetail } from './views/RaffleDetail';
import { Heart, Sparkles } from 'lucide-react';

function NavigationRouter() {
  const { user, loginWithGoogle, logout } = useAuth();
  const [currentRoute, setCurrentRoute] = useState({ view: 'home', params: null });

  // Handle parsing hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      
      if (!hash || hash === '#/') {
        setCurrentRoute({ view: 'home', params: null });
      } else if (hash === '#/dashboard') {
        setCurrentRoute({ view: 'dashboard', params: null });
      } else if (hash === '#/create') {
        setCurrentRoute({ view: 'create', params: null });
      } else if (hash.startsWith('#/raffle/')) {
        const id = hash.replace('#/raffle/', '');
        setCurrentRoute({ view: 'detail', params: id });
      } else {
        setCurrentRoute({ view: 'home', params: null });
      }
    };

    // Run once on mount
    handleHashChange();

    // Listen to route changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (view, params = null) => {
    if (view === 'home') {
      window.location.hash = '#/';
    } else if (view === 'dashboard') {
      window.location.hash = '#/dashboard';
    } else if (view === 'create') {
      window.location.hash = '#/create';
    } else if (view === 'detail' && params) {
      window.location.hash = `#/raffle/${params}`;
    }
  };

  // Render correct view based on state
  const renderView = () => {
    switch (currentRoute.view) {
      case 'dashboard':
        return <Dashboard onNavigate={navigateTo} />;
      case 'create':
        return <CreateRaffle onNavigate={navigateTo} />;
      case 'detail':
        return <RaffleDetail raffleId={currentRoute.params} onNavigate={navigateTo} />;
      case 'home':
      default:
        return <Home onNavigate={navigateTo} />;
    }
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="header-bar" style={{ zIndex: 10 }}>
        <div 
          onClick={() => navigateTo('home')} 
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
        >
          <div style={{
            background: 'linear-gradient(135deg, var(--color-bright) 0%, var(--color-accent) 100%)',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '900',
            fontFamily: 'var(--font-title)'
          }}>
            RS
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: '800', fontFamily: 'var(--font-title)', color: 'white', letterSpacing: '0.5px' }}>
            RifaSolidaria
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {user ? (
            <>
              <button
                onClick={() => navigateTo('dashboard')}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', fontWeight: '700' }}
              >
                Mi Panel
              </button>
              <button
                onClick={() => {
                  logout();
                  navigateTo('home');
                }}
                className="btn btn-secondary"
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: 'var(--color-danger)',
                  border: '1px solid rgba(239, 68, 68, 0.25)'
                }}
              >
                Salir
              </button>
            </>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="btn btn-primary"
              style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', fontWeight: '700' }}
            >
              Iniciar Sesión
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main style={{ flex: 1, position: 'relative', zIndex: 5 }}>
        {renderView()}
      </main>

      {/* Footer */}
      <footer className="footer-text">
        <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
          Hecho con <Heart size={10} style={{ color: 'var(--color-danger)', fill: 'currentColor' }} /> para impacto comunitario.
        </p>
        <p>© 2026 RifaSolidaria.app • Herramienta de uso libre y gratuito.</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <DatabaseProvider>
        <NavigationRouter />
      </DatabaseProvider>
    </AuthProvider>
  );
}

export default App;
