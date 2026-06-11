import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { ImageExporter } from '../components/ImageExporter';
import { LegalDisclaimer } from '../components/LegalDisclaimer';
import { validateParticipantName } from '../utils/profanityFilter';
import { compressImage } from '../utils/imageCompressor';
import { 
  ArrowLeft, Share2, Clipboard, MessageSquare, AlertTriangle, 
  HelpCircle, Trophy, UserCheck, ShieldAlert, Check, X, RefreshCw,
  Edit, Plus, Trash2, Upload, Image as ImageIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const RaffleDetail = ({ raffleId, onNavigate }) => {
  const { user } = useAuth();
  const { getRaffleById, updateRaffleNumbers, updateRaffleWinner, updateRaffle, registerParticipantNumber, reportRaffle, deleteRaffle } = useDatabase();
  
  const [raffle, setRaffle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Manual Winner State (per-prize inputs mapping prize.id -> string)
  const [manualWinnerInputs, setManualWinnerInputs] = useState({});
  const [activeDrawPrizeId, setActiveDrawPrizeId] = useState(null);

  // Visitor state
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);

  // Visitor Claim Name states (for Sorteador Digital Interno / Free Raffle)
  const [activeClaimNumber, setActiveClaimNumber] = useState(null);
  const [claimName, setClaimName] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claiming, setClaiming] = useState(false);

  // Pagination & Search states
  const [activePage, setActivePage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Admin state
  const [selectedAdminNumber, setSelectedAdminNumber] = useState(null);
  const [shareMessage, setShareMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Draw simulation state
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [rollingNumber, setRollingNumber] = useState(null);
  const [winnerNumber, setWinnerNumber] = useState(null);

  // Expanded prize image viewer modal
  const [expandedPrizeImage, setExpandedPrizeImage] = useState(null);

  // Edit Raffle State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editBeneficiary, setEditBeneficiary] = useState('');
  const [editPrizes, setEditPrizes] = useState([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editImageLoadingMap, setEditImageLoadingMap] = useState({});

  const isAdmin = user && raffle && user.id === raffle.creator_id;

  const fetchRaffle = async () => {
    try {
      const data = await getRaffleById(raffleId);
      if (!data) {
        setError('La rifa solicitada no existe o fue eliminada.');
      } else {
        setRaffle(data);
        
        // Initialize default share message
        const shareLink = `${window.location.origin}${window.location.pathname}#/raffle/${data.id}`;
        const formattedDate = new Date(data.draw_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
        
        if (data.draw_type === 'internal') {
          setShareMessage(
            `¡Hola! Te invito a participar de la rifa gratuita "${data.title}" en beneficio de "${data.beneficiary}".\n\n` +
            `🔮 Sortea en la App el día ${formattedDate}\n\n` +
            `🏆 Premios:\n${data.prizes.map((p, i) => `${i+1}° P: ${p.name}`).join('\n')}\n\n` +
            `🎟️ Valor del número: ¡GRATUITO!\n` +
            `🔗 Registrá tu nombre en el número que elijas ingresando acá: ${shareLink}`
          );
        } else {
          setShareMessage(
            `¡Hola! Te invito a colaborar con la rifa solidaria "${data.title}" en beneficio de "${data.beneficiary}".\n\n` +
            `🔮 Sortea por: ${data.draw_method} (${data.draw_moment || 'Nocturna'}) el ${formattedDate}\n\n` +
            `🏆 Premios:\n${data.prizes.map((p, i) => `${i+1}° P: ${p.name}`).join('\n')}\n\n` +
            `🎟️ Valor del número: $${data.ticket_value.toLocaleString('es-AR')}\n` +
            `🔗 Elegí tus números ingresando acá: ${shareLink}`
          );
        }
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar los detalles de la rifa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRaffle();
  }, [raffleId, user]);

  const handleNumberClick = (num) => {
    const numberInfo = raffle.numbers_state[num] || 0;
    const status = typeof numberInfo === 'object' ? numberInfo.status : numberInfo;
    const participantName = typeof numberInfo === 'object' ? numberInfo.name : '';

    if (isAdmin) {
      // Admin clicks to manage the status/name of a specific number
      setSelectedAdminNumber(num);
    } else {
      if (raffle.draw_type === 'internal') {
        if (status !== 0) {
          const label = raffle.ticket_type === 'custom'
            ? `El identificador ${num}`
            : `El número ${num.toString().padStart(raffle.total_numbers > 99 ? 3 : 2, '0')}`;
          alert(`${label} ya está registrado a nombre de: ${participantName}`);
          return;
        }
        setClaimName('');
        setClaimError('');
        setActiveClaimNumber(num);
      } else {
        // Visitor clicks to select/deselect a number in paid/external draws (only if it is Free)
        if (status !== 0) return;

        if (selectedNumbers.includes(num)) {
          setSelectedNumbers(selectedNumbers.filter(n => n !== num));
        } else {
          setSelectedNumbers([...selectedNumbers, num]);
        }
      }
    }
  };

  const handleAdminStatusChange = async (status) => {
    if (!isAdmin || !selectedAdminNumber) return;

    try {
      const updatedNumbers = { ...raffle.numbers_state };
      if (status === 0) {
        const currentTicketState = raffle.numbers_state[selectedAdminNumber];
        const currentStatus = typeof currentTicketState === 'object' ? currentTicketState?.status : currentTicketState;
        
        if (currentStatus === 2) {
          if (currentTicketState && typeof currentTicketState === 'object' && currentTicketState.paid_at) {
            const paidTime = new Date(currentTicketState.paid_at);
            const now = new Date();
            if (now - paidTime > 24 * 60 * 60 * 1000) {
              alert("Por razones de seguridad, solo se puede desmarcar un número pagado dentro de las primeras 24 horas de haber sido registrado.");
              return;
            }
          }
        }
        delete updatedNumbers[selectedAdminNumber]; // 0 is Free (empty key)
      } else if (status === 1) {
        updatedNumbers[selectedAdminNumber] = {
          status: 1,
          reserved_at: new Date().toISOString()
        };
      } else if (status === 2) {
        updatedNumbers[selectedAdminNumber] = {
          status: 2,
          paid_at: new Date().toISOString()
        };
      }

      const updatedRaffle = await updateRaffleNumbers(raffle.id, updatedNumbers, user);
      setRaffle(updatedRaffle);
      setSelectedAdminNumber(null);
    } catch (err) {
      alert(err.message || 'Error al actualizar el número.');
    }
  };

  const handleAdminRegisterName = async (name) => {
    if (!isAdmin || !selectedAdminNumber) return;
    try {
      const validation = validateParticipantName(name);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }
      
      const updatedNumbers = { ...raffle.numbers_state };
      updatedNumbers[selectedAdminNumber] = {
        status: 2,
        name: validation.cleanName,
        paid_at: new Date().toISOString()
      };

      const updatedRaffle = await updateRaffleNumbers(raffle.id, updatedNumbers, user);
      setRaffle(updatedRaffle);
      setSelectedAdminNumber(null);
    } catch (err) {
      alert(err.message || 'Error al registrar el número.');
    }
  };

  const handleDeleteRaffle = async () => {
    if (!isAdmin || !raffle) return;

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
      ? '¿Estás seguro de que deseas eliminar este sorteo? Esta acción no se puede deshacer.'
      : '¿Estás seguro de que deseas eliminar este sorteo externo? Se perderán todos los datos y esta acción no se puede deshacer.';
      
    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteRaffle(raffle.id, user);
      alert('Sorteo eliminado exitosamente.');
      if (onNavigate) {
        onNavigate('dashboard');
      }
    } catch (err) {
      alert(err.message || 'Error al eliminar el sorteo.');
    }
  };

  const handleCopyShare = () => {
    navigator.clipboard.writeText(shareMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppSend = () => {
    if (selectedNumbers.length === 0) return;
    
    const numsStr = selectedNumbers.map(n => n.toString().padStart(2, '0')).join(', ');
    const totalCost = selectedNumbers.length * raffle.ticket_value;
    
    const msg = 
      `Hola, quiero reservar los números: *${numsStr}* para la rifa *"${raffle.title}"* en beneficio de *"${raffle.beneficiary}"*.\n\n` +
      `Ya realicé la transferencia de *\$${totalCost.toLocaleString('es-AR')}* al alias *"${raffle.payment_alias}"*.\n` +
      `Te adjunto el comprobante de pago.`;

    const cleanPhone = raffle.whatsapp_phone.replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // Run the local digital raffle draw for a specific prize
  const handleStartDraw = (prizeId) => {
    // Only numbers marked as Paid (2) participate
    const paidNumbers = [];
    const tickets = (raffle.ticket_type === 'custom' && raffle.custom_tickets) 
      ? raffle.custom_tickets 
      : Array.from({ length: raffle.total_numbers || 100 }, (_, idx) => String(idx + 1));

    if (raffle.ticket_type === 'custom') {
      paidNumbers.push(...tickets);
    } else {
      for (const ticket of tickets) {
        const info = raffle.numbers_state[ticket];
        const status = typeof info === 'object' ? info?.status : info;
        if (status === 2) {
          paidNumbers.push(ticket);
        }
      }
    }

    if (paidNumbers.length === 0) {
      alert(raffle.ticket_type === 'custom' 
        ? 'La lista de identificadores está vacía, no se puede realizar el sorteo.' 
        : 'Debe haber al menos un número marcado como PAGADO/VENDIDO (X) para realizar el sorteo.'
      );
      return;
    }

    setActiveDrawPrizeId(prizeId);
    setShowDrawModal(true);
    setDrawing(true);
    setWinnerNumber(null);

    // Simulate roulette rolling numbers
    let counter = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * paidNumbers.length);
      setRollingNumber(paidNumbers[randomIndex]);
      counter++;

      if (counter > 25) {
        clearInterval(interval);
        // Determine final winner
        const finalWinnerIndex = Math.floor(Math.random() * paidNumbers.length);
        const winner = paidNumbers[finalWinnerIndex];

        const updatedPrizes = raffle.prizes.map(p => 
          p.id === prizeId ? { ...p, winning_number: winner } : p
        );

        // Save winner to database so it persists
        updateRaffleWinner(raffle.id, updatedPrizes, user).then(updated => {
          setRaffle(updated);
          setWinnerNumber(winner);
          setDrawing(false);

          // Confetti effect!
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });
        }).catch(err => {
          alert('Error al registrar el ganador: ' + err.message);
          setDrawing(false);
        });
      }
    }, 100);
  };

  const handleSaveManualWinner = async (e, prizeId) => {
    e.preventDefault();
    const inputVal = manualWinnerInputs[prizeId] || '';
    let isValidTicket = false;
    let ticketStr = inputVal.trim();

    if (raffle.ticket_type === 'custom') {
      isValidTicket = raffle.custom_tickets && raffle.custom_tickets.includes(ticketStr);
    } else {
      const num = parseInt(ticketStr, 10);
      isValidTicket = !isNaN(num) && num >= 1 && num <= raffle.total_numbers;
      if (isValidTicket) {
        ticketStr = String(num);
      }
    }

    if (!isValidTicket) {
      alert(raffle.ticket_type === 'custom'
        ? `El identificador ganador debe ser uno de los configurados en la rifa.`
        : `El número ganador debe estar entre 1 y ${raffle.total_numbers}.`
      );
      return;
    }

    try {
      const updatedPrizes = raffle.prizes.map(p => 
        p.id === prizeId ? { ...p, winning_number: ticketStr } : p
      );
      const updated = await updateRaffleWinner(raffle.id, updatedPrizes, user);
      setRaffle(updated);
      setManualWinnerInputs(prev => ({ ...prev, [prizeId]: '' }));
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (err) {
      alert(err.message || 'Error al guardar el ganador.');
    }
  };

  const handleResetWinner = async (prizeId) => {
    const prize = raffle.prizes.find(p => p.id === prizeId);
    if (!window.confirm(`¿Estás seguro de que quieres anular el ganador registrado para "${prize.name}"?`)) return;
    try {
      const updatedPrizes = raffle.prizes.map(p => 
        p.id === prizeId ? { ...p, winning_number: null } : p
      );
      const updated = await updateRaffleWinner(raffle.id, updatedPrizes, user);
      setRaffle(updated);
    } catch (err) {
      alert(err.message || 'Error al anular el ganador.');
    }
  };

  const handleOpenEditModal = () => {
    setEditTitle(raffle.title);
    setEditSubtitle(raffle.subtitle);
    setEditBeneficiary(raffle.beneficiary);
    setEditPrizes(raffle.prizes.map(p => ({ ...p })));
    setEditError('');
    setEditSaving(false);
    setShowEditModal(true);
  };

  const handleAddEditPrize = () => {
    setEditPrizes([...editPrizes, { id: Date.now(), name: '', image: null }]);
  };

  const handleRemoveEditPrize = (id) => {
    if (editPrizes.length === 1) return;
    setEditPrizes(editPrizes.filter(p => p.id !== id));
  };

  const handleEditPrizeNameChange = (id, val) => {
    setEditPrizes(editPrizes.map(p => p.id === id ? { ...p, name: val } : p));
  };

  const handleEditImageUpload = async (prizeId, file) => {
    if (!file) return;

    setEditImageLoadingMap(prev => ({ ...prev, [prizeId]: true }));
    try {
      const compressedBase64 = await compressImage(file, 800, 800, 0.7);
      setEditPrizes(editPrizes.map(p => p.id === prizeId ? { ...p, image: compressedBase64 } : p));
    } catch (err) {
      alert(err.message || 'Error al procesar la imagen.');
    } finally {
      setEditImageLoadingMap(prev => ({ ...prev, [prizeId]: false }));
    }
  };

  const handleRemoveEditImage = (prizeId) => {
    setEditPrizes(editPrizes.map(p => p.id === prizeId ? { ...p, image: null } : p));
  };

  const handleSaveEditRaffle = async (e) => {
    e.preventDefault();
    setEditError('');

    const filteredPrizes = editPrizes.filter(p => p.name.trim() !== '');
    if (filteredPrizes.length === 0) {
      setEditError('Debes agregar al menos un premio.');
      return;
    }

    if (!editTitle.trim()) {
      setEditError('El título no puede estar vacío.');
      return;
    }

    if (!editSubtitle.trim()) {
      setEditError('El subtítulo no puede estar vacío.');
      return;
    }

    if (!editBeneficiary.trim()) {
      setEditError('El beneficiario no puede estar vacío.');
      return;
    }

    setEditSaving(true);
    try {
      const updated = await updateRaffle(raffle.id, {
        title: editTitle,
        subtitle: editSubtitle,
        beneficiary: editBeneficiary,
        prizes: filteredPrizes.map((p, index) => ({ id: index + 1, name: p.name, image: p.image || null }))
      }, user);

      setRaffle(updated);
      setShowEditModal(false);
    } catch (err) {
      setEditError(err.message || 'Error al guardar los cambios.');
    } finally {
      setEditSaving(false);
    }
  };

  const pageSize = 100;
  const totalPages = Math.ceil((raffle?.total_numbers || 100) / pageSize);

  const handleSearch = (val) => {
    setSearchQuery(val);
    if (raffle.ticket_type === 'custom' && raffle.custom_tickets) {
      const idx = raffle.custom_tickets.indexOf(val.trim());
      if (idx !== -1) {
        const pageIndex = Math.floor(idx / pageSize);
        setActivePage(pageIndex);
      }
    } else {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 1 && num <= raffle.total_numbers) {
        const pageIndex = Math.floor((num - 1) / pageSize);
        setActivePage(pageIndex);
      }
    }
  };

  const renderPagination = () => {
    if (!raffle || raffle.total_numbers <= 100) return null;
    const tabs = [];
    for (let p = 0; p < totalPages; p++) {
      const start = p * pageSize + 1;
      const end = Math.min((p + 1) * pageSize, raffle.total_numbers);
      const isActive = activePage === p;
      tabs.push(
        <button
          key={p}
          onClick={() => setActivePage(p)}
          className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            padding: '0.35rem 0.65rem',
            fontSize: '0.75rem',
            borderRadius: '8px',
            flexShrink: 0
          }}
        >
          {start}-{end}
        </button>
      );
    }
    return (
      <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', padding: '0.25rem 0', margin: '0.5rem 0 1rem 0', scrollbarWidth: 'none' }}>
        {tabs}
      </div>
    );
  };

  const renderGrid = () => {
    const cells = [];
    const total = raffle.total_numbers || 100;
    
    // Determine the ticket identifiers to render
    let ticketsToRender = [];
    if (raffle.ticket_type === 'custom' && raffle.custom_tickets) {
      const startIdx = activePage * pageSize;
      const endIdx = Math.min((activePage + 1) * pageSize, raffle.custom_tickets.length);
      ticketsToRender = raffle.custom_tickets.slice(startIdx, endIdx);
    } else {
      const start = raffle.total_numbers <= 100 ? 1 : activePage * pageSize + 1;
      const end = raffle.total_numbers <= 100 ? total : Math.min((activePage + 1) * pageSize, total);
      for (let i = start; i <= end; i++) {
        ticketsToRender.push(String(i));
      }
    }

    for (const ticket of ticketsToRender) {
      const numberInfo = raffle.numbers_state[ticket] || 0; // 0=Free, or object {status, name}, or number
      const status = typeof numberInfo === 'object' ? numberInfo.status : numberInfo;
      const participantName = typeof numberInfo === 'object' ? numberInfo.name : '';

      let stateClass = 'state-free';
      if (status === 1) stateClass = 'state-reserved';
      if (status === 2) stateClass = 'state-paid';
      
      // If selected by visitor (only in external paid draws)
      if (!isAdmin && raffle.draw_type !== 'internal' && selectedNumbers.includes(ticket)) {
        stateClass = 'state-selected';
      }

      // If searched
      const isSearched = searchQuery !== '' && searchQuery === ticket;
      const searchHighlightStyle = isSearched ? {
        transform: 'scale(1.15)',
        boxShadow: '0 0 15px var(--color-bright)',
        border: '2px solid var(--color-bright)',
        zIndex: 5
      } : {};

      // Dynamic style for custom identifiers (badge horizontal shape)
      const isCustomId = raffle.ticket_type === 'custom';
      const cellDynamicStyle = isCustomId ? {
        aspectRatio: '2.2 / 1', // Horizontal badge
        fontSize: ticket.length > 6 ? '0.7rem' : '0.8rem',
        borderRadius: '6px',
        padding: '0.25rem 0.4rem',
        ...searchHighlightStyle
      } : searchHighlightStyle;

      cells.push(
        <button
          key={ticket}
          onClick={() => handleNumberClick(ticket)}
          className={`number-cell ${stateClass}`}
          style={cellDynamicStyle}
          title={status !== 0 && participantName ? `Registrado a nombre de: ${participantName}` : undefined}
        >
          {isCustomId ? ticket : ticket.padStart(raffle.total_numbers > 99 ? 3 : 2, '0')}
        </button>
      );
    }
    return cells;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="loader"></div>
      </div>
    );
  }

  if (error || !raffle) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <ShieldAlert size={48} style={{ color: 'var(--color-danger)', margin: '0 auto 1rem' }} />
        <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '0.75rem' }}>Ocurrió un error</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{error}</p>
        <button onClick={() => onNavigate('home')} className="btn btn-primary">
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
        <button
          onClick={() => onNavigate(isAdmin ? 'dashboard' : 'home')}
          className="btn btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', gap: '0.35rem' }}
        >
          <ArrowLeft size={16} />
          {isAdmin ? 'Mi Panel' : 'Inicio'}
        </button>
        
        {isAdmin && (
          <span className="badge badge-success" style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <UserCheck size={12} />
            Tu Rifa (Modo Admin)
          </span>
        )}
      </div>

      {/* Winner Announcement Banner */}
      {(() => {
        // Check if any prize has a winning number, or if the main raffle.winning_number is set
        const hasWinners = raffle.winning_number || (raffle.prizes && raffle.prizes.some(p => p.winning_number));
        if (!hasWinners) return null;

        return (
          <div className="glass-card" style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.25) 100%)',
            border: '2px solid var(--color-warning)',
            padding: '1.25rem',
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <Trophy style={{ color: 'var(--color-warning)', margin: '0 auto 0.5rem', display: 'block' }} size={32} />
            <h2 style={{ color: 'white', fontSize: '1.4rem', marginBottom: '0.75rem' }}>¡Sorteo Realizado!</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '500px', margin: '0 auto', textAlign: 'left' }}>
              {raffle.prizes.map((prize, idx) => {
                // Determine winning number for this prize
                // For legacy compatibility, if the first prize doesn't have a winning_number but raffle.winning_number is set, use raffle.winning_number
                let winNum = prize.winning_number;
                if (!winNum && idx === 0 && raffle.winning_number) {
                  winNum = raffle.winning_number;
                }

                const winnerInfo = winNum ? raffle.numbers_state[winNum] : null;
                const winnerName = typeof winnerInfo === 'object' ? winnerInfo?.name : '';

                return (
                  <div key={prize.id} style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(251, 191, 36, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <strong style={{ color: 'white', fontSize: '0.85rem' }}>🏆 {prize.name}</strong>
                      {winNum ? (
                        <span className="badge badge-warning" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                          {raffle.ticket_type === 'custom' ? 'ID: ' : 'N°: '}{raffle.ticket_type === 'custom' ? winNum : winNum.toString().padStart(raffle.total_numbers > 99 ? 3 : 2, '0')}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Pendiente de sorteo</span>
                      )}
                    </div>
                    {winNum && (
                      <div style={{ fontSize: '0.9rem', color: 'var(--color-bright)', fontWeight: '700', marginTop: '0.25rem' }}>
                        👤 Ganador/a: <span style={{ color: 'white' }}>{winnerName || 'Sin registrar (libre)'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '1rem' }}>
              El sorteo se realizó por: <strong>{raffle.draw_method}</strong> {raffle.draw_type === 'external' ? `(${raffle.draw_moment})` : ''}.
            </p>
          </div>
        );
      })()}

      {/* Raffle Info Poster card */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center', borderBottom: '3px solid var(--color-accent)' }}>
        
        {/* Title & subtitle */}
        <div>
          <h1 className="neon-title" style={{ fontSize: '2.1rem', marginBottom: '0.25rem' }}>{raffle.title}</h1>
          <p style={{ color: 'var(--color-bright)', fontWeight: '600', fontSize: '0.95rem', textTransform: 'uppercase' }}>
            {raffle.subtitle}
          </p>
        </div>

        {/* Draw details pill */}
        <div style={{
          alignSelf: 'center',
          background: 'rgba(37, 99, 235, 0.15)',
          border: '1px solid var(--border-glow)',
          borderRadius: '99px',
          padding: '0.5rem 1.25rem',
          fontSize: '0.85rem',
          fontWeight: '700',
          color: 'white',
          lineHeight: '1.4'
        }}>
          {raffle.draw_type === 'internal' ? (
            <>
              Sorteo: <span style={{ color: 'var(--color-bright)' }}>Sorteador Digital Interno (App)</span>
              <br />
              Fecha: {new Date(raffle.draw_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
              <span style={{ margin: '0 0.5rem', color: 'rgba(255,255,255,0.2)' }}>|</span>
              Valor: <span style={{ color: 'var(--color-success)' }}>Gratuito</span>
            </>
          ) : (
            <>
              Sortea por: <span style={{ color: 'var(--color-bright)' }}>{raffle.draw_method}</span> ({raffle.draw_moment || 'Nocturna'}) 
              <br />
              Fecha: {new Date(raffle.draw_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
              <span style={{ margin: '0 0.5rem', color: 'rgba(255,255,255,0.2)' }}>|</span>
              Valor: ${raffle.ticket_value.toLocaleString('es-AR')}
            </>
          )}
        </div>

        {/* Causa Beneficiaria */}
        <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '0.85rem' }}>
          🤝 Causa: <strong style={{ color: 'white' }}>{raffle.beneficiary}</strong>
        </div>

        {/* Prizes listing */}
        <div style={{ textAlign: 'left', background: 'rgba(10, 20, 60, 0.3)', borderRadius: '12px', padding: '0.85rem', border: '1px solid rgba(255,255,255,0.02)' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: '700', display: 'block', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>
            Premios en juego:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {raffle.prizes.map((prize, idx) => {
              // Support legacy compatibility
              let winNum = prize.winning_number;
              if (!winNum && idx === 0 && raffle.winning_number) {
                winNum = raffle.winning_number;
              }

              const winnerInfo = winNum ? raffle.numbers_state[winNum] : null;
              const winnerName = typeof winnerInfo === 'object' ? winnerInfo?.name : '';

              return (
                <div key={prize.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderBottom: idx < raffle.prizes.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', paddingBottom: idx < raffle.prizes.length - 1 ? '0.5rem' : '0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'white', fontWeight: '500' }}>
                    <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', textAlign: 'left' }}>
                      <span>🏆</span>
                      <span>{prize.name}</span>
                    </span>
                    {prize.image && (
                      <button
                        onClick={() => setExpandedPrizeImage({ src: prize.image, name: prize.name })}
                        className="btn"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          padding: '0.2rem 0.4rem',
                          fontSize: '0.7rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer',
                          color: 'var(--color-bright)',
                          flexShrink: 0
                        }}
                      >
                        <img src={prize.image} alt="Premio mini" style={{ width: '18px', height: '18px', objectFit: 'cover', borderRadius: '3px' }} />
                        Ver Foto
                      </button>
                    )}
                  </div>
                  {winNum && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-warning)', paddingLeft: '1.45rem', textAlign: 'left' }}>
                      🎉 Ganador/a: <strong>{winnerName || 'Sin registrar (libre)'}</strong> (N° {raffle.ticket_type === 'custom' ? winNum : winNum.toString().padStart(raffle.total_numbers > 99 ? 3 : 2, '0')})
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'center', justifyContent: 'center', width: '100%', marginTop: '0.25rem' }}>
            <button
              onClick={handleOpenEditModal}
              className="btn btn-secondary"
              style={{
                padding: '0.45rem 1.2rem',
                fontSize: '0.8rem',
                gap: '0.35rem',
                borderRadius: '10px',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                background: 'rgba(56, 189, 248, 0.05)',
                color: 'var(--color-bright)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              <Edit size={14} />
              Editar Rifa
            </button>
            <button
              onClick={handleDeleteRaffle}
              className="btn btn-danger"
              style={{
                padding: '0.45rem 1.2rem',
                fontSize: '0.8rem',
                gap: '0.35rem',
                borderRadius: '10px',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              <Trash2 size={14} />
              Eliminar Rifa
            </button>
          </div>
        )}
      </div>

      {/* Grid Guide / Legend */}
      <div style={{ display: 'flex', justifySelf: 'center', justifyContent: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ width: '12px', height: '12px', background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', borderRadius: '3px' }}></div>
          <span>Libre</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ width: '12px', height: '12px', background: 'rgba(15,23,42,0.6)', border: '1.5px dashed var(--color-warning)', borderRadius: '3px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-warning)', fontSize: '8px', fontWeight: '900' }}>✓</div>
          <span>Reservado</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ width: '12px', height: '12px', background: 'rgba(15,23,42,0.8)', border: '1.5px solid var(--color-danger)', borderRadius: '3px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)', fontSize: '7px', fontWeight: '900' }}>✕</div>
          <span>Pagado</span>
        </div>
      </div>

      {/* Interactive Grid Card */}
      <div className="glass-card" style={{ padding: '1rem' }}>
        
        {/* Search bar inside the grid card */}
        {raffle.total_numbers > 100 && (
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <input
              type="number"
              placeholder="Buscar un número específico (ej. 450)..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="form-control"
              style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
              min="1"
              max={raffle.total_numbers}
            />
          </div>
        )}

        {/* Pagination tabs */}
        {renderPagination()}

        <div className="raffle-grid" style={{ 
          gridTemplateColumns: raffle.ticket_type === 'custom' 
            ? 'repeat(auto-fill, minmax(115px, 1fr))' 
            : raffle.total_numbers <= 50 ? 'repeat(5, 1fr)' : 'repeat(10, 1fr)',
          gap: raffle.ticket_type === 'custom' ? '12px' : '8px'
        }}>
          {renderGrid()}
        </div>
        
        {isAdmin && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.5rem', textAlign: 'center' }}>
            💡 Hacé clic en cualquier número para cambiar su estado (Libre / Reservado / Pagado).
          </p>
        )}
      </div>

      {/* VISITOR MODE: Bottom action bar when numbers are selected */}
      {!isAdmin && raffle.draw_type !== 'internal' && selectedNumbers.length > 0 && (
        <div className="glass-card" style={{
          position: 'sticky',
          bottom: '1rem',
          zIndex: 99,
          border: '1.5px solid var(--color-bright)',
          boxShadow: '0 10px 30px rgba(56, 189, 248, 0.25)',
          background: 'rgba(8, 14, 44, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          textAlign: 'center',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-bright)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Números Seleccionados:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'center', margin: '0.35rem 0' }}>
              {selectedNumbers.map(n => (
                <span key={n} style={{ background: 'var(--color-accent)', color: 'white', fontWeight: '700', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                  {n.toString().padStart(2, '0')}
                </span>
              ))}
            </div>
            <p style={{ color: 'white', fontSize: '1rem', fontWeight: '700', marginTop: '0.25rem' }}>
              Total a Transferir: ${(selectedNumbers.length * raffle.ticket_value).toLocaleString('es-AR')}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={() => setShowPaymentInfo(!showPaymentInfo)}
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              {showPaymentInfo ? 'Ocultar Datos de Transferencia' : '1. Ver Datos de Pago (Alias)'}
            </button>

            {showPaymentInfo && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '0.85rem',
                borderRadius: '12px',
                fontSize: '0.85rem',
                textAlign: 'left'
              }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'block' }}>ALIAS DE TRANSFERENCIA:</span>
                <span style={{ color: 'white', fontWeight: '700', fontSize: '1.05rem', wordBreak: 'break-all', display: 'block', margin: '0.25rem 0' }}>
                  {raffle.payment_alias}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(raffle.payment_alias);
                    alert('Alias copiado al portapapeles.');
                  }}
                  className="btn"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.3rem 0.75rem', fontSize: '0.7rem', marginTop: '0.25rem' }}
                >
                  <Clipboard size={12} style={{ marginRight: '0.25rem' }} /> Copiar Alias
                </button>
              </div>
            )}

            <button
              onClick={handleWhatsAppSend}
              className="btn btn-primary"
              style={{ width: '100%', gap: '0.5rem', background: '#25D366', boxShadow: '0 4px 12px rgba(37,211,102,0.3)' }}
            >
              <MessageSquare size={16} fill="currentColor" />
              2. Reservar por WhatsApp y Enviar Comprobante
            </button>
          </div>
        </div>
      )}

      {/* ADMIN MODE: Manage selected number */}
      {isAdmin && selectedAdminNumber && (() => {
        const adminNumberInfo = raffle.numbers_state[selectedAdminNumber] || 0;
        const adminStatus = typeof adminNumberInfo === 'object' ? adminNumberInfo.status : adminNumberInfo;
        const adminName = typeof adminNumberInfo === 'object' ? adminNumberInfo.name : '';

        if (raffle.draw_type === 'internal') {
          return (
            <div className="modal-overlay" onClick={() => setSelectedAdminNumber(null)} style={{ background: 'rgba(0,0,0,0.5)', zIndex: 100 }}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', animation: 'slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                <h3 style={{ color: 'white', fontSize: '1.15rem', marginBottom: '0.5rem', textAlign: 'center' }}>
                  {raffle.ticket_type === 'custom' ? 'Administrar Identificador: ' : 'Administrar Número: '}
                  <span style={{ color: 'var(--color-bright)' }}>
                    {raffle.ticket_type === 'custom' ? selectedAdminNumber : selectedAdminNumber.toString().padStart(raffle.total_numbers > 99 ? 3 : 2, '0')}
                  </span>
                </h3>
                
                {adminStatus === 2 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: '12px', textAlign: 'left', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>REGISTRADO A NOMBRE DE:</span>
                      <strong style={{ color: 'white', fontSize: '1.1rem', display: 'block', marginTop: '0.25rem' }}>{adminName}</strong>
                    </div>
                    
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                      Como administrador, podés liberar este casillero si la persona decide cambiar de número o cancelar.
                    </p>
                    
                    <button
                      onClick={() => handleAdminStatusChange(0)}
                      className="btn btn-danger"
                      style={{ width: '100%', padding: '0.8rem', borderRadius: '10px' }}
                    >
                      Liberar Número (Volver a Libre)
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                      Este casillero está libre. Podés registrar directamente el nombre de un participante:
                    </p>
                    
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const nameInput = e.target.elements.adminParticipantName.value;
                      await handleAdminRegisterName(nameInput);
                    }} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <input
                        name="adminParticipantName"
                        type="text"
                        placeholder="Nombre del participante"
                        className="form-control"
                        required
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                      >
                        Registrar Nombre
                      </button>
                    </form>
                  </div>
                )}

                <button
                  onClick={() => setSelectedAdminNumber(null)}
                  className="btn"
                  style={{ background: 'transparent', color: 'var(--color-text-muted)', fontSize: '0.85rem', width: '100%', marginTop: '1.25rem', textDecoration: 'underline' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          );
        }

        // External raffle admin manager modal
        return (
          <div className="modal-overlay" onClick={() => setSelectedAdminNumber(null)} style={{ background: 'rgba(0,0,0,0.5)', zIndex: 100 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', animation: 'slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
              <h3 style={{ color: 'white', fontSize: '1.15rem', marginBottom: '0.5rem', textAlign: 'center' }}>
                Administrar Número: <span style={{ color: 'var(--color-bright)' }}>{selectedAdminNumber.toString().padStart(raffle.total_numbers > 99 ? 3 : 2, '0')}</span>
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                Cambiá el estado de este casillero según el pago recibido:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={() => handleAdminStatusChange(0)}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'space-between', padding: '0.8rem 1.2rem' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '14px', height: '14px', background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', borderRadius: '3px' }}></div>
                    Marcar como LIBRE
                  </span>
                  {!adminStatus && <Check size={16} className="text-success" />}
                </button>

                <button
                  onClick={() => handleAdminStatusChange(1)}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'space-between', padding: '0.8rem 1.2rem' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--color-warning)', fontWeight: '900' }}>✓</span>
                    Marcar como RESERVADO
                  </span>
                  {adminStatus === 1 && <Check size={16} className="text-success" />}
                </button>

                <button
                  onClick={() => handleAdminStatusChange(2)}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'space-between', padding: '0.8rem 1.2rem' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--color-danger)', fontWeight: '900' }}>✕</span>
                    Marcar como PAGADO
                  </span>
                  {adminStatus === 2 && <Check size={16} className="text-success" />}
                </button>
              </div>

              <button
                onClick={() => setSelectedAdminNumber(null)}
                className="btn"
                style={{ background: 'transparent', color: 'var(--color-text-muted)', fontSize: '0.85rem', width: '100%', marginTop: '1.25rem', textDecoration: 'underline' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        );
      })()}

      {/* ADMIN ACTIONS: Exporter, Link sharing & Raffle Draw */}
      {isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Sorteador Section (Based on Configured Draw Type) */}
          {raffle.draw_type === 'internal' ? (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1.5px solid var(--color-warning)' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <Trophy style={{ color: 'var(--color-warning)' }} size={20} />
                Sorteador Digital Integrado
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                Seleccioná qué premio sortear. El sistema elegirá un ganador aleatoriamente entre los números registrados como **PAGADOS**.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                {raffle.prizes.map((prize, idx) => {
                  let winNum = prize.winning_number;
                  if (!winNum && idx === 0 && raffle.winning_number) {
                    winNum = raffle.winning_number;
                  }

                  const winnerInfo = winNum ? raffle.numbers_state[winNum] : null;
                  const winnerName = typeof winnerInfo === 'object' ? winnerInfo?.name : '';

                  return (
                    <div key={prize.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <strong style={{ color: 'white', fontSize: '0.85rem' }}>🏆 {prize.name}</strong>
                      
                      {winNum ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <p style={{ color: 'var(--color-success)', fontWeight: '700', fontSize: '0.8rem', margin: 0 }}>
                            Sorteado: {raffle.ticket_type === 'custom' ? winNum : winNum.toString().padStart(raffle.total_numbers > 99 ? 3 : 2, '0')}
                            {winnerName && ` - ${winnerName}`}
                          </p>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <button
                              onClick={() => handleStartDraw(prize.id)}
                              className="btn btn-secondary"
                              style={{ flex: 1, padding: '0.35rem', fontSize: '0.75rem', minHeight: 'auto' }}
                            >
                              Sortear de Nuevo
                            </button>
                            <button
                              onClick={() => handleResetWinner(prize.id)}
                              className="btn btn-danger"
                              style={{ flex: 1, padding: '0.35rem', fontSize: '0.75rem', minHeight: 'auto', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                            >
                              Anular Ganador
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartDraw(prize.id)}
                          className="btn"
                          style={{
                            background: 'linear-gradient(135deg, var(--color-warning) 0%, #d97706 100%)',
                            color: 'white',
                            fontWeight: '700',
                            fontSize: '0.8rem',
                            padding: '0.45rem 1rem',
                            boxShadow: '0 4px 10px rgba(245, 158, 11, 0.15)'
                          }}
                        >
                          <Trophy size={12} style={{ marginRight: '0.25rem' }} />
                          Iniciar Sorteo
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1.5px solid var(--color-warning)' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <Trophy style={{ color: 'var(--color-warning)' }} size={20} />
                Registrar Ganadores del Sorteo Externo
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                El sorteo se realiza por el medio externo: **{raffle.draw_method}** ({raffle.draw_moment}). Registrá el billete ganador de cada premio aquí.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                {raffle.prizes.map((prize, idx) => {
                  let winNum = prize.winning_number;
                  if (!winNum && idx === 0 && raffle.winning_number) {
                    winNum = raffle.winning_number;
                  }

                  const winnerInfo = winNum ? raffle.numbers_state[winNum] : null;
                  const winnerName = typeof winnerInfo === 'object' ? winnerInfo?.name : '';

                  return (
                    <div key={prize.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <strong style={{ color: 'white', fontSize: '0.85rem' }}>🏆 {prize.name}</strong>

                      {winNum ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <p style={{ color: 'var(--color-success)', fontWeight: '700', fontSize: '0.8rem', margin: 0 }}>
                            Registrado: {raffle.ticket_type === 'custom' ? winNum : winNum.toString().padStart(raffle.total_numbers > 99 ? 3 : 2, '0')}
                            {winnerName && ` - ${winnerName}`}
                          </p>
                          <button
                            onClick={() => handleResetWinner(prize.id)}
                            className="btn btn-danger"
                            style={{ width: '100%', marginTop: '0.25rem', padding: '0.35rem', fontSize: '0.75rem', minHeight: 'auto', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                          >
                            Anular Ganador
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={(e) => handleSaveManualWinner(e, prize.id)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: 0 }}>
                          <input
                            type={raffle.ticket_type === 'custom' ? 'text' : 'number'}
                            placeholder={raffle.ticket_type === 'custom' ? 'ID Ganador' : 'N° Ganador'}
                            value={manualWinnerInputs[prize.id] || ''}
                            onChange={(e) => setManualWinnerInputs(prev => ({ ...prev, [prize.id]: e.target.value }))}
                            className="form-control"
                            style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.8rem', minHeight: 'auto', height: '32px' }}
                            min={raffle.ticket_type === 'custom' ? undefined : "1"}
                            max={raffle.ticket_type === 'custom' ? undefined : raffle.total_numbers}
                            required
                          />
                          <button type="submit" className="btn btn-primary" style={{ padding: '0 0.75rem', fontSize: '0.8rem', height: '32px', minHeight: 'auto' }}>
                            Guardar
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Poster Image Exporter component */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'white', textAlign: 'left' }}>Exportar Tablero</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textAlign: 'left', lineHeight: '1.4' }}>
              Genera una imagen optimizada del estado actual de tu rifa para publicarla en tus historias de WhatsApp, Instagram o Facebook.
            </p>
            <ImageExporter raffle={raffle} />
          </div>

          {/* Share Link & Custom Message creator */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
            <h3 style={{ fontSize: '1rem', color: 'white' }}>Compartir Rifa</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
              Copia este mensaje listo para enviar con el enlace de tu rifa:
            </p>
            <textarea
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              className="form-control"
              rows="5"
              style={{ fontSize: '0.8rem', background: 'rgba(10, 15, 45, 0.8)', resize: 'none' }}
            ></textarea>
            
            <button
              onClick={handleCopyShare}
              className="btn btn-secondary"
              style={{ gap: '0.5rem', width: '100%', fontSize: '0.85rem' }}
            >
              <Share2 size={16} />
              {copied ? '¡Copiado con éxito!' : 'Copiar Mensaje y Enlace'}
            </button>
          </div>

        </div>
      )}

      {/* Sorteador Digital Roulette Modal */}
      {showDrawModal && (() => {
        const activeDrawPrize = raffle.prizes?.find(p => p.id === activeDrawPrizeId);
        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '2.5rem 1.5rem' }}>
              
              {drawing ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                  <Trophy size={48} className="text-warning" style={{ color: 'var(--color-warning)', animation: 'bounce 1s infinite' }} />
                  <h3>Sorteando: {activeDrawPrize?.name || 'Ganador'}...</h3>
                  <div style={{
                    fontSize: (rollingNumber && rollingNumber.toString().length > 4) ? '2.5rem' : '4.5rem',
                    fontWeight: '900',
                    color: 'white',
                    fontFamily: 'var(--font-title)',
                    background: 'rgba(37,99,235,0.15)',
                    border: '2px solid var(--color-bright)',
                    borderRadius: '24px',
                    width: (rollingNumber && rollingNumber.toString().length > 4) ? 'auto' : '120px',
                    minWidth: '120px',
                    height: '120px',
                    padding: (rollingNumber && rollingNumber.toString().length > 4) ? '0 1rem' : '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 30px rgba(56,189,248,0.4)',
                    boxSizing: 'border-box'
                  }}>
                    {rollingNumber ? (raffle.ticket_type === 'custom' ? rollingNumber : rollingNumber.toString().padStart(2, '0')) : '--'}
                  </div>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    Eligiendo de forma aleatoria entre todos los números pagados
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                  <Trophy size={56} style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.5))' }} />
                  <h2 style={{ color: 'white', fontSize: '1.5rem' }}>¡Tenemos un Ganador!</h2>
                  {activeDrawPrize && (
                    <p style={{ color: 'var(--color-bright)', fontSize: '0.9rem', fontWeight: '600', margin: 0 }}>
                      Premio: {activeDrawPrize.name}
                    </p>
                  )}
                  
                  <div style={{
                    fontSize: (winnerNumber && winnerNumber.toString().length > 4) ? '2.8rem' : '5rem',
                    fontWeight: '900',
                    color: 'white',
                    fontFamily: 'var(--font-title)',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                    borderRadius: '24px',
                    width: (winnerNumber && winnerNumber.toString().length > 4) ? 'auto' : '140px',
                    minWidth: '140px',
                    height: '140px',
                    padding: (winnerNumber && winnerNumber.toString().length > 4) ? '0 1.25rem' : '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 40px rgba(251,191,36,0.6)',
                    animation: 'scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
                    boxSizing: 'border-box'
                  }}>
                    {winnerNumber ? (raffle.ticket_type === 'custom' ? winnerNumber : winnerNumber.toString().padStart(raffle.total_numbers > 99 ? 3 : 2, '0')) : '--'}
                  </div>
                  
                  <p style={{ color: 'white', fontWeight: '600', fontSize: '0.95rem' }}>
                    {raffle.ticket_type === 'custom' ? 'El identificador sorteado es' : 'El número sorteado es el'} {winnerNumber ? (raffle.ticket_type === 'custom' ? winnerNumber : winnerNumber.toString().padStart(raffle.total_numbers > 99 ? 3 : 2, '0')) : ''} 🎉
                  </p>
  
                  {winnerNumber && (() => {
                    const info = raffle.numbers_state[winnerNumber];
                    const name = typeof info === 'object' ? info?.name : '';
                    if (name) {
                      return (
                        <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                          <p style={{ color: 'var(--color-bright)', fontWeight: '800', fontSize: '1.3rem', textShadow: '0 0 10px rgba(56, 189, 248, 0.5)' }}>
                            {name}
                          </p>
                          <p style={{ color: 'white', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                            ¡Felicitaciones al ganador/a! 🥳
                          </p>
                        </div>
                      );
                    }
                    return (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', maxWidth: '280px' }}>
                        Verificá en la grilla a quién corresponde este casillero y contactalo para hacer la entrega del premio.
                      </p>
                    );
                  })()}
  
                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '0.75rem' }}>
                    <button
                      onClick={() => handleStartDraw(activeDrawPrizeId)}
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '0.85rem', gap: '0.25rem' }}
                    >
                      <RefreshCw size={14} />
                      Sortear de Nuevo
                    </button>
                    <button
                      onClick={() => setShowDrawModal(false)}
                      className="btn btn-primary"
                      style={{ flex: 1, fontSize: '0.85rem' }}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Visitor claim name modal for internal free raffles */}
      {activeClaimNumber !== null && (
        <div className="modal-overlay" onClick={() => { if (!claiming) setActiveClaimNumber(null); }} style={{ zIndex: 100 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', padding: '1.75rem', textAlign: 'center' }}>
            <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              {raffle.ticket_type === 'custom' ? 'Registrar Identificador ' : 'Registrar Número '}
              <span style={{ color: 'var(--color-bright)' }}>
                {raffle.ticket_type === 'custom' ? activeClaimNumber : activeClaimNumber.toString().padStart(raffle.total_numbers > 99 ? 3 : 2, '0')}
              </span>
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Este sorteo es **gratuito** y para eventos presenciales. Ingresá tu nombre para reservar este {raffle.ticket_type === 'custom' ? 'identificador' : 'número'}.
            </p>

            {claimError && (
              <div style={{
                padding: '0.6rem 0.85rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: 'var(--color-danger)',
                fontSize: '0.75rem',
                textAlign: 'left',
                marginBottom: '1rem'
              }}>
                ⚠️ {claimError}
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              setClaimError('');
              setClaiming(true);
              try {
                const updated = await registerParticipantNumber(raffle.id, activeClaimNumber, claimName);
                setRaffle(updated);
                setActiveClaimNumber(null);
                setClaimName('');
                confetti({
                  particleCount: 50,
                  spread: 60,
                  origin: { y: 0.8 }
                });
              } catch (err) {
                setClaimError(err.message || 'Error al registrar el número.');
              } finally {
                setClaiming(false);
              }
            }}>
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
                <label className="form-label">Tu Nombre y Apellido (Solo letras)</label>
                <input
                  type="text"
                  placeholder="Ej: Roberto Carlos"
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  className="form-control"
                  disabled={claiming}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveClaimNumber(null);
                    setClaimName('');
                    setClaimError('');
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  disabled={claiming}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={claiming}
                >
                  {claiming ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LegalDisclaimer raffle={raffle} />
      {/* Expanded Prize Image Viewer Modal */}
      {expandedPrizeImage && (
        <div className="modal-overlay" onClick={() => setExpandedPrizeImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', padding: '1.5rem', textAlign: 'center' }}>
            <h3 style={{ color: 'white', fontSize: '1.1rem', marginBottom: '0.75rem', wordBreak: 'break-word' }}>
              {expandedPrizeImage.name}
            </h3>
            <div style={{
              width: '100%',
              maxHeight: '380px',
              borderRadius: '12px',
              border: '1.5px solid var(--border-glow)',
              overflow: 'hidden',
              background: '#030616',
              marginBottom: '1.25rem'
            }}>
              <img src={expandedPrizeImage.src} alt={expandedPrizeImage.name} style={{ width: '100%', height: 'auto', maxHeight: '376px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
            </div>
            <button onClick={() => setExpandedPrizeImage(null)} className="btn btn-primary" style={{ width: '100%' }}>
              Cerrar Vista
            </button>
          </div>
        </div>
      )}

      {/* ADMIN Edit Raffle Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => { if (!editSaving) setShowEditModal(false); }} style={{ zIndex: 100, overflowY: 'auto', padding: '2rem 1rem' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%', padding: '1.75rem', textAlign: 'left' }}>
            <h3 style={{ color: 'white', fontSize: '1.25rem', marginBottom: '0.5rem', textAlign: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.5rem' }}>
              Editar Rifa
            </h3>

            {editError && (
              <div style={{
                padding: '0.6rem 0.85rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: 'var(--color-danger)',
                fontSize: '0.75rem',
                textAlign: 'left',
                marginBottom: '1rem'
              }}>
                ⚠️ {editError}
              </div>
            )}

            <form onSubmit={handleSaveEditRaffle} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Título de la Rifa</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Subtítulo o Copete</label>
                <input
                  type="text"
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Causa o Beneficiario</label>
                <input
                  type="text"
                  value={editBeneficiary}
                  onChange={(e) => setEditBeneficiary(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                  required
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>Premios</label>
                  <button
                    type="button"
                    onClick={handleAddEditPrize}
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', gap: '0.2rem', borderRadius: '6px' }}
                  >
                    <Plus size={12} />
                    Agregar
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                  {editPrizes.map((prize, idx) => (
                    <div key={prize.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', width: '35px', fontWeight: '700' }}>
                          {idx + 1}° P.
                        </span>
                        <input
                          type="text"
                          placeholder="Nombre del premio..."
                          value={prize.name}
                          onChange={(e) => handleEditPrizeNameChange(prize.id, e.target.value)}
                          className="form-control"
                          style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveEditPrize(prize.id)}
                          disabled={editPrizes.length === 1}
                          className="btn btn-danger"
                          style={{ padding: '0.45rem', borderRadius: '8px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '35px' }}>
                        {editImageLoadingMap[prize.id] ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: 'var(--color-bright)' }}>
                            <div className="loader" style={{ width: '12px', height: '12px', borderTopColor: 'white' }}></div>
                            Optimizando...
                          </div>
                        ) : prize.image ? (
                          <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '6px', border: '1px solid var(--border-glow-active)', overflow: 'hidden' }}>
                            <img src={prize.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              type="button"
                              onClick={() => handleRemoveEditImage(prize.id)}
                              style={{
                                position: 'absolute',
                                top: '1px',
                                right: '1px',
                                background: 'rgba(239, 68, 68, 0.85)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '14px',
                                height: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <X size={8} />
                            </button>
                          </div>
                        ) : (
                          <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px dashed rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}>
                            <Upload size={10} />
                            Subir foto
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleEditImageUpload(prize.id, e.target.files[0])}
                              style={{ display: 'none' }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: '0.85rem' }}
                  disabled={editSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: '0.85rem', gap: '0.35rem' }}
                  disabled={editSaving}
                >
                  {editSaving ? (
                    <>
                      <div className="loader" style={{ width: '14px', height: '14px', borderTopColor: 'white' }}></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
