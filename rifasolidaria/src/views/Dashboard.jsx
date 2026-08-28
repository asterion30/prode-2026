import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { 
  LogOut, Plus, Calendar, Ticket, ChevronRight, AlertTriangle, 
  Trash2, ShieldCheck, User, Mail, Phone, ExternalLink, Search, 
  DollarSign, CheckCircle2
} from 'lucide-react';

export const Dashboard = ({ onNavigate }) => {
  const { user, isSuperAdmin, logout } = useAuth();
  const { raffles, getAllRaffles, deleteRaffle } = useDatabase();
  const [userRaffles, setUserRaffles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Superadmin state
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'admin' : 'my-raffles');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState('all'); // 'all', 'active', 'finished', 'reported'

  const handleDeleteClick = async (raffle) => {
    if (raffle.draw_type === 'external' && !isSuperAdmin) {
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

    const confirmMsg = isSuperAdmin && raffle.creator_id !== user.id
      ? `⚠️ ACCIÓN SUPERADMIN: ¿Estás seguro de que deseas eliminar permanentemente la rifa "${raffle.title}" del usuario ${raffle.creator_name} (${raffle.creator_email})?`
      : raffle.draw_type === 'internal'
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
    if (!user) {
      onNavigate('home');
      return;
    }

    const fetchInitial = async () => {
      try {
        setLoading(true);
        await getAllRaffles();
      } catch (err) {
        console.error("Error fetching user raffles:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, [user]);

  useEffect(() => {
    if (user && raffles) {
      const filtered = raffles.filter(r => r.creator_id === user.id);
      setUserRaffles(filtered);
    }
  }, [user, raffles]);

  if (!user) return null;

  // Helpers for stats and filtering
  const allRafflesList = raffles || [];

  const getRaffleStatus = (raffle) => {
    const hasWinner = raffle.winning_number || (raffle.prizes && raffle.prizes.some(p => p.winning_number));
    if (hasWinner) return 'finished';
    const drawDate = new Date(raffle.draw_date);
    drawDate.setHours(23, 59, 59, 999);
    if (new Date() > drawDate) return 'expired';
    return 'active';
  };

  const filteredAdminRaffles = allRafflesList.filter(raffle => {
    const status = getRaffleStatus(raffle);
    
    // Status filter
    if (adminFilter === 'active' && status !== 'active') return false;
    if (adminFilter === 'finished' && status !== 'finished' && status !== 'expired') return false;
    if (adminFilter === 'reported' && (!raffle.reports_count || raffle.reports_count <= 0)) return false;

    // Search query
    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase().trim();
      const matchTitle = raffle.title?.toLowerCase().includes(q);
      const matchCreatorName = raffle.creator_name?.toLowerCase().includes(q);
      const matchCreatorEmail = raffle.creator_email?.toLowerCase().includes(q);
      const matchBeneficiary = raffle.beneficiary?.toLowerCase().includes(q);
      const matchPhone = raffle.whatsapp_phone?.includes(q);
      return matchTitle || matchCreatorName || matchCreatorEmail || matchBeneficiary || matchPhone;
    }

    return true;
  });

  // Global metrics for Superadmin
  const totalGlobalRevenue = allRafflesList.reduce((acc, raffle) => {
    const sold = Object.values(raffle.numbers_state || {}).filter(s => (typeof s === 'object' ? s?.status : s) === 2).length;
    return acc + (sold * (Number(raffle.ticket_value) || 0));
  }, 0);

  const totalReportedRaffles = allRafflesList.filter(r => (r.reports_count || 0) > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Header Profile Card */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="avatar" style={{ 
              position: 'relative',
              background: isSuperAdmin ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : undefined 
            }}>
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block' }}>Bienvenido</span>
                {isSuperAdmin && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#fbbf24',
                    fontSize: '0.65rem',
                    fontWeight: '800',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '999px',
                    letterSpacing: '0.5px'
                  }}>
                    <ShieldCheck size={11} />
                    SUPERADMIN
                  </span>
                )}
              </div>
              <span style={{ fontWeight: '700', color: 'white', fontSize: '1rem', display: 'block' }}>
                {user.displayName}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {user.email}
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

      {/* Superadmin Tab Navigation (if applicable) */}
      {isSuperAdmin && (
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          background: 'rgba(255,255,255,0.03)', 
          padding: '0.35rem', 
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.06)'
        }}>
          <button
            onClick={() => setActiveTab('admin')}
            style={{
              flex: 1,
              padding: '0.6rem 0.8rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s',
              border: activeTab === 'admin' ? '1px solid rgba(245, 158, 11, 0.5)' : 'none',
              background: activeTab === 'admin' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.25) 100%)' : 'transparent',
              color: activeTab === 'admin' ? '#fbbf24' : 'var(--color-text-muted)'
            }}
          >
            <ShieldCheck size={16} />
            Panel Superadmin ({allRafflesList.length})
          </button>
          <button
            onClick={() => setActiveTab('my-raffles')}
            style={{
              flex: 1,
              padding: '0.6rem 0.8rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s',
              border: activeTab === 'my-raffles' ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
              background: activeTab === 'my-raffles' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: activeTab === 'my-raffles' ? 'white' : 'var(--color-text-muted)'
            }}
          >
            <Ticket size={16} />
            Mis Sorteos ({userRaffles.length})
          </button>
        </div>
      )}

      {/* ================= SUPERADMIN PANEL VIEW ================= */}
      {isSuperAdmin && activeTab === 'admin' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Header Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck style={{ color: '#fbbf24' }} size={22} />
                Control Global de Rifas
              </h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                Visualización de todas las rifas creadas y sus respectivos organizadores
              </p>
            </div>
            <button
              onClick={() => onNavigate('create')}
              className="btn btn-primary"
              style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', gap: '0.35rem' }}
            >
              <Plus size={16} />
              Nueva Rifa
            </button>
          </div>

          {/* Superadmin Metrics Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
            gap: '0.75rem' 
          }}>
            <div className="glass-card" style={{ padding: '0.85rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Total Rifas</span>
              <strong style={{ fontSize: '1.4rem', color: 'white' }}>{allRafflesList.length}</strong>
            </div>
            <div className="glass-card" style={{ padding: '0.85rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Rifas Activas</span>
              <strong style={{ fontSize: '1.4rem', color: 'var(--color-bright)' }}>
                {allRafflesList.filter(r => getRaffleStatus(r) === 'active').length}
              </strong>
            </div>
            <div className="glass-card" style={{ padding: '0.85rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Recaudación Global</span>
              <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>
                ${totalGlobalRevenue.toLocaleString('es-AR')}
              </strong>
            </div>
            <div className="glass-card" style={{ padding: '0.85rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Con Reportes</span>
              <strong style={{ fontSize: '1.4rem', color: totalReportedRaffles > 0 ? '#ef4444' : 'var(--color-text-muted)' }}>
                {totalReportedRaffles}
              </strong>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ position: 'relative' }}>
              <Search 
                size={16} 
                style={{ 
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'var(--color-text-muted)' 
                }} 
              />
              <input
                type="text"
                placeholder="Buscar por título, organizador, email o teléfono..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem 0.65rem 2.2rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {[
                { id: 'all', label: 'Todas' },
                { id: 'active', label: 'Activas' },
                { id: 'finished', label: 'Finalizadas/Sorteó' },
                { id: 'reported', label: 'Reportadas' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setAdminFilter(f.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    border: '1px solid',
                    borderColor: adminFilter === f.id ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)',
                    background: adminFilter === f.id ? 'var(--color-accent)' : 'rgba(255,255,255,0.04)',
                    color: adminFilter === f.id ? 'white' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Superadmin Raffles Grid */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <div className="loader"></div>
            </div>
          ) : filteredAdminRaffles.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                No se encontraron rifas que coincidan con los criterios de búsqueda.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredAdminRaffles.map((raffle) => {
                const soldCount = Object.values(raffle.numbers_state || {}).filter(state => {
                  const status = typeof state === 'object' ? state?.status : state;
                  return status === 2;
                }).length;
                const reservedCount = Object.values(raffle.numbers_state || {}).filter(state => {
                  const status = typeof state === 'object' ? state?.status : state;
                  return status === 1;
                }).length;
                const total = raffle.total_numbers || 100;
                const progressPercent = Math.round((soldCount / total) * 100);
                const status = getRaffleStatus(raffle);
                const ticketVal = Number(raffle.ticket_value) || 0;
                const revenue = soldCount * ticketVal;

                // Clean phone for whatsapp
                const cleanPhone = (raffle.whatsapp_phone || '').replace(/[^0-9]/g, '');

                return (
                  <div
                    key={raffle.id}
                    className="glass-card"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      borderLeft: status === 'active' ? '4px solid #10b981' : status === 'finished' ? '4px solid #6366f1' : '4px solid #94a3b8'
                    }}
                  >
                    {/* Top Row: Owner / Creator info */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <User size={12} />
                          ORGANIZADOR / DUEÑO
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                          <strong style={{ color: 'white', fontSize: '0.95rem' }}>{raffle.creator_name}</strong>
                          {raffle.creator_id === user.id && (
                            <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', color: 'var(--color-bright)' }}>
                              (Tú)
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Mail size={12} />
                            {raffle.creator_email}
                          </span>
                          {raffle.whatsapp_phone && (
                            <a 
                              href={`https://wa.me/${cleanPhone}`} 
                              target="_blank" 
                              rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#25D366', textDecoration: 'none', fontWeight: '600' }}
                            >
                              <Phone size={12} />
                              {raffle.whatsapp_phone}
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {status === 'active' && (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.2rem 0.5rem', borderRadius: '999px', fontWeight: '700' }}>
                            ● Activa
                          </span>
                        )}
                        {status === 'finished' && (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '0.2rem 0.5rem', borderRadius: '999px', fontWeight: '700' }}>
                            ✓ Finalizada
                          </span>
                        )}
                        {status === 'expired' && (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.3)', padding: '0.2rem 0.5rem', borderRadius: '999px', fontWeight: '700' }}>
                            Fecha Vencida
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Raffle Content Details */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div>
                          <h3 style={{ color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>{raffle.title}</h3>
                          {raffle.subtitle && (
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.1rem' }}>
                              {raffle.subtitle}
                            </p>
                          )}
                        </div>
                        {raffle.ticket_value > 0 ? (
                          <span style={{ color: '#10b981', fontWeight: '800', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                            ${ticketVal.toLocaleString('es-AR')} <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>/núm</span>
                          </span>
                        ) : (
                          <span style={{ color: '#38bdf8', fontWeight: '700', fontSize: '0.8rem' }}>Gratuita</span>
                        )}
                      </div>
                      
                      {raffle.beneficiary && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-bright)', marginTop: '0.25rem' }}>
                          <strong>Beneficiario:</strong> {raffle.beneficiary}
                        </p>
                      )}
                    </div>

                    {/* Sales Progress & Revenue */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>
                        <span>Ventas: <strong>{soldCount} / {total}</strong> ({progressPercent}%)</span>
                        <span>Recaudado: <strong style={{ color: '#10b981' }}>${revenue.toLocaleString('es-AR')}</strong></span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-accent), var(--color-bright))', borderRadius: '999px' }}></div>
                      </div>
                    </div>

                    {/* Metadata & Actions Bottom Bar */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      flexWrap: 'wrap', 
                      gap: '0.75rem',
                      borderTop: '1px solid rgba(255,255,255,0.05)', 
                      paddingTop: '0.75rem' 
                    }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar size={13} style={{ color: 'var(--color-bright)' }} />
                          Sortea: {new Date(raffle.draw_date).toLocaleDateString('es-AR')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Ticket size={13} style={{ color: 'var(--color-bright)' }} />
                          {reservedCount} Reservados
                        </div>
                        {raffle.reports_count > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', fontWeight: '700' }}>
                            <AlertTriangle size={13} />
                            {raffle.reports_count} {raffle.reports_count === 1 ? 'Reporte' : 'Reportes'}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          onClick={() => onNavigate('detail', raffle.id)}
                          className="btn btn-primary"
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', gap: '0.3rem' }}
                        >
                          Ver Tablero
                          <ChevronRight size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(raffle)}
                          className="btn-icon"
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '8px',
                            padding: '0.4rem',
                            color: '#f87171',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                          title="Eliminar Rifa (Superadmin)"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      ) : (
        /* ================= REGULAR USER / MY RAFFLES VIEW ================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Main Actions Header */}
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

          {/* User Raffles List */}
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
                const soldCount = Object.values(raffle.numbers_state || {}).filter(state => {
                  const status = typeof state === 'object' ? state?.status : state;
                  return status === 2;
                }).length;
                const reservedCount = Object.values(raffle.numbers_state || {}).filter(state => {
                  const status = typeof state === 'object' ? state?.status : state;
                  return status === 1;
                }).length;
                const progressPercent = Math.round((soldCount / (raffle.total_numbers || 100)) * 100);

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
                        <span>{soldCount} / {raffle.total_numbers || 100} Vendidos</span>
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

