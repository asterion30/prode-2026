import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { Shield, Sparkles, Heart, HelpCircle, ArrowRight, Star } from 'lucide-react';

export const Home = ({ onNavigate }) => {
  const { user, loginWithGoogle } = useAuth();
  const { raffles, getAllRaffles } = useDatabase();

  useEffect(() => {
    getAllRaffles().catch(err => console.error("Error fetching raffles:", err));
  }, []);

  // Generate stars background positions
  const [stars, setStars] = useState([]);
  useEffect(() => {
    const starCount = 20;
    const generated = Array.from({ length: starCount }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 3 + 1}px`,
      duration: `${Math.random() * 3 + 2}s`,
      opacity: Math.random() * 0.7 + 0.3
    }));
    setStars(generated);
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      
      {/* Background Pulsing Stars */}
      <div className="stars-container">
        {stars.map((star) => (
          <div
            key={star.id}
            className="star"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              '--duration': star.duration,
              '--opacity': star.opacity
            }}
          />
        ))}
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', zIndex: 1, position: 'relative' }}>
        
        {/* Hero Section */}
        <div style={{ textAlign: 'center', padding: '2.5rem 0 1.5rem 0' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 1rem',
            background: 'rgba(37, 99, 235, 0.12)',
            border: '1.5px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '999px',
            color: 'var(--color-bright)',
            fontSize: '0.8rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '1rem'
          }}>
            <Heart size={14} style={{ fill: 'currentColor' }} />
            Herramienta 100% Gratuita y Solidaria
          </div>
          
          <h1 className="neon-title" style={{ fontSize: '2.75rem', fontWeight: '800', marginBottom: '0.75rem' }}>
            Rifa Solidaria
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '1.05rem', lineHeight: '1.5', maxWidth: '460px', margin: '0 auto' }}>
            Organizá y gestioná sorteos digitales para cooperadoras, clubes, causas de salud o comunitarias de manera transparente.
          </p>
        </div>

        {/* CTA Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.4rem', color: 'white' }}>Creá tu tablero interactivo</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: '1.4' }}>
            Accedé con tu cuenta de Google para diseñar una rifa, definir premios, registrar los pagos y exportar imágenes listas para tus redes sociales.
          </p>
          
          {user ? (
            <button
              onClick={() => onNavigate('dashboard')}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', gap: '0.5rem' }}
            >
              Ir a mi Panel de Control
              <ArrowRight size={18} />
            </button>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', gap: '0.75rem' }}
            >
              {/* Simple Google Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Comenzar con Google
            </button>
          )}
        </div>

        {/* Explore Active Raffles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Star size={16} className="text-success" style={{ color: 'var(--color-bright)', fill: 'currentColor' }} />
            Explorar Ejemplos Activos
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {raffles.map((raffle) => (
              <div
                key={raffle.id}
                onClick={() => onNavigate('detail', raffle.id)}
                className="glass-card"
                style={{
                  padding: '1.2rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderLeft: '4px solid var(--color-accent)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.4rem' }}>
                  <h4 style={{ color: 'white', fontSize: '1.1rem' }}>{raffle.title}</h4>
                  <span className="badge badge-info">${raffle.ticket_value} c/u</span>
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '0.6rem' }}>
                  {raffle.subtitle}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  <span>Causa: <strong>{raffle.beneficiary}</strong></span>
                  <span>•</span>
                  <span>Sortea: <strong>{new Date(raffle.draw_date).toLocaleDateString('es-AR')}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security & Concept Description */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '1rem',
          textAlign: 'left',
          background: 'rgba(10, 15, 45, 0.3)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '1.25rem'
        }}>
          <h3 style={{ fontSize: '1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={18} style={{ color: 'var(--color-bright)' }} />
            Seguridad y Transparencia
          </h3>
          <ul style={{
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
            paddingLeft: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            lineHeight: '1.4'
          }}>
            <li>
              <strong>Identidad Validada:</strong> Quienes organizan una rifa deben autenticarse mediante Google. Su email es público y visible en la rifa, evitando el anonimato.
            </li>
            <li>
              <strong>Sin Dinero en la App:</strong> Todo pago se hace de manera externa y directa (transferencia bancaria/Mercado Pago), eliminando riesgos de comisiones o retenciones.
            </li>
            <li>
              <strong>Botón de Denuncia:</strong> Los usuarios pueden reportar rifas sospechosas para mantener un entorno seguro y libre de abusos o fraudes.
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
};
