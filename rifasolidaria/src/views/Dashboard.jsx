import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { LogOut, Plus, Settings, Calendar, Heart, Ticket, ChevronRight, AlertTriangle, Trash2 } from 'lucide-react';

export const Dashboard = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const { raffles, getAllRaffles, deleteRaffle } = useDatabase();
  const [userRaffles, setUserRaffles] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleDeleteClick = async (raffle) => {
    if (raffle.draw_type === 'external') {
      const hasPaidTickets = Object.values(raffle.numbers_state).some(state => {
        const status = typeof state === 'object' ? state?.status : state;
        return status === 2;
      });

      if (hasPaidTickets) {
        const today = new Date();
        const drawLimit = new Date(raffle.draw_date);
        today.setHours(0, 0, 0, 0);
        drawLimit.setHours(0, 0, 0, 0);

        if (today <= drawLimit) {
          alert('No se puede eliminar un sorteo externo con números pagados antes de la fecha del sorteo para proteger a los participantes.');
          return;
        }
      }
    }

    const confirmMsg = raffle.draw_type === 'internal'
      ? `¿Estás seguro de que deseas eliminar el sorteo "${raffle.title}"? Esta acción no se puede deshacer.`
      : `¿Estás seguro de que deseas eliminar el sorteo externo "${raffle.title}"? Se perderán todos los datos y esta acción no se puede deshacer.`;
      
    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteRaffle(raffle.id, user);
      alert('Sorteo eliminado exitosamente.');
    } catch (err) {
      alert(err.message || 'Error al eliminar el sorteo.');
    }
  };

  useEffect(() => {
    // If not logged in, redirect to home
    if (!user) {
      onNavigate('home');
      return;
    }

    const fetchUserRaffles = async () => {
      setLoading(true);
      const all = await getAllRaffles();
      const filtered = all.filter(r => r.creator_id === user.id);
      setUserRaffles(filtered);
      setLoading(false);
    };

    fetchUserRaffles();
  }, [user, raffles]);

  if (!user) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Profile Card */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="user-profile">
            <div className="avatar">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block' }}>Bienvenido</span>
              <span style={{ fontWeight: '700', color: 'white', fontSize: '1rem', display: 'block' }}>
                {user.displayName}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              onNavigate('home');
            }}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', display: 'flex', gap: '0.35rem' }}
          >
            <LogOut size={14} />
            Salir
          </button>
        </div>
      </div>

      {/* Main Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.3rem', color: 'white' }}>Mis Sorteos</h2>
        <button
          onClick={() => onNavigate('create')}
          className="btn btn-primary"
          style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', gap: '0.35rem' }}
        >
          <Plus size={16} />
          Nueva Rifa
        </button>
      </div>

      {/* Raffles List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="loader"></div>
        </div>
      ) : userRaffles.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎫</div>
          <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '0.5rem' }}>Aún no creaste rifas</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: '300px', margin: '0 auto 1.5rem' }}>
            Comenzá a recaudar fondos para tu causa creando tu primer tablero interactivo de números.
          </p>
          <button
            onClick={() => onNavigate('create')}
            className="btn btn-primary"
            style={{ margin: '0 auto' }}
          >
            Crear Rifa Solidaria
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {userRaffles.map((raffle) => {
            const soldCount = Object.values(raffle.numbers_state).filter(state => {
              const status = typeof state === 'object' ? state?.status : state;
              return status === 2;
            }).length;
            const reservedCount = Object.values(raffle.numbers_state).filter(state => {
              const status = typeof state === 'object' ? state?.status : state;
              return status === 1;
            }).length;
            const progressPercent = Math.round((soldCount / raffle.total_numbers) * 100);

            return (
              <div
                key={raffle.id}
                onClick={() => onNavigate('detail', raffle.id)}
                className="glass-card"
                style={{
                  padding: '1.25rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
              >
                {/* Raffle Info Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
                  <div>
                    <h3 style={{ color: 'white', fontSize: '1.15rem' }}>{raffle.title}</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                      {raffle.subtitle}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(raffle);
                      }}
                      className="btn-icon"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '8px',
                        padding: '0.35rem',
                        color: '#f87171',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      title="Eliminar Sorteo"
                    >
                      <Trash2 size={16} />
                    </button>
                    <ChevronRight size={20} style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ margin: '0.85rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>
                    <span>Progreso de Ventas ({progressPercent}%)</span>
                    <span>{soldCount} / {raffle.total_numbers} Vendidos</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-accent), var(--color-bright))', borderRadius: '999px' }}></div>
                  </div>
                </div>

                {/* Badges and details */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={13} style={{ color: 'var(--color-bright)' }} />
                    Sortea: {new Date(raffle.draw_date).toLocaleDateString('es-AR')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Ticket size={13} style={{ color: 'var(--color-bright)' }} />
                    {reservedCount} Reservados
                  </div>
                  {raffle.reports_count > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-danger)', fontWeight: '600' }}>
                      <AlertTriangle size={13} />
                      {raffle.reports_count} {raffle.reports_count === 1 ? 'Reporte' : 'Reportes'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Home Back Button */}
      <button
        onClick={() => onNavigate('home')}
        className="btn btn-secondary"
        style={{ marginTop: '1rem', width: '100%' }}
      >
        Volver a la Página de Inicio
      </button>

    </div>
  );
};
