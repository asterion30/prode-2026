import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [showMockLogin, setShowMockLogin] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('rifasolidaria_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const loginWithGoogle = () => {
    setShowMockLogin(true);
  };

  const handleSelectAccount = (email, name) => {
    const mockUser = {
      id: `google-${email.replace(/[^a-zA-Z0-9]/g, '')}`,
      email,
      displayName: name,
      photoURL: null,
    };
    localStorage.setItem('rifasolidaria_user', JSON.stringify(mockUser));
    setUser(mockUser);
    setShowMockLogin(false);
    setCustomEmail('');
    setCustomName('');
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customEmail || !customName) return;
    handleSelectAccount(customEmail, customName);
  };

  const logout = () => {
    localStorage.removeItem('rifasolidaria_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loginWithGoogle, logout }}>
      {children}

      {/* Mock Google Login Overlay Modal */}
      {showMockLogin && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Fake Google Logo */}
              <div style={{ display: 'flex', gap: '2px', fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.5rem', fontFamily: 'var(--font-title)' }}>
                <span style={{ color: '#4285F4' }}>G</span>
                <span style={{ color: '#EA4335' }}>o</span>
                <span style={{ color: '#FBBC05' }}>o</span>
                <span style={{ color: '#4285F4' }}>g</span>
                <span style={{ color: '#34A853' }}>l</span>
                <span style={{ color: '#EA4335' }}>e</span>
              </div>
              <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '0.25rem' }}>Iniciar sesión</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Simulación de Google Sign-in para pruebas locales
              </p>
            </div>

            {/* Test Accounts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <button
                onClick={() => handleSelectAccount('maria.fundacion@gmail.com', 'María Luz (Fundación Solidaria)')}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '0.6rem 1rem', width: '100%', fontSize: '0.85rem' }}
              >
                <span style={{ marginRight: '0.5rem' }}>👩‍⚕️</span>
                <strong>maria.fundacion@gmail.com</strong>
              </button>
              <button
                onClick={() => handleSelectAccount('carlos.bombero@gmail.com', 'Carlos Gómez (Bomberos Voluntarios)')}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '0.6rem 1rem', width: '100%', fontSize: '0.85rem' }}
              >
                <span style={{ marginRight: '0.5rem' }}>👨‍🚒</span>
                <strong>carlos.bombero@gmail.com</strong>
              </button>
              <button
                onClick={() => handleSelectAccount('club.social@gmail.com', 'Club Deportivo Juventud')}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '0.6rem 1rem', width: '100%', fontSize: '0.85rem' }}
              >
                <span style={{ marginRight: '0.5rem' }}>⚽</span>
                <strong>club.social@gmail.com</strong>
              </button>
            </div>

            <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>O ingresá otra cuenta</span>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }} />
            </div>

            {/* Custom Mock Account Form */}
            <form onSubmit={handleCustomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
              <div>
                <input
                  type="text"
                  placeholder="Nombre de Mostrar"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                  required
                />
              </div>
              <div>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}>
                Entrar con Google Mock
              </button>
            </form>

            <button
              onClick={() => setShowMockLogin(false)}
              className="btn"
              style={{ background: 'transparent', color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '1rem', textDecoration: 'underline' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
