import React, { createContext, useContext, useState, useEffect } from 'react';
import { validateParticipantName } from '../utils/profanityFilter';

const DatabaseContext = createContext(null);

// Initial mock raffles data so the user has something to test right away
const INITIAL_MOCK_RAFFLES = [
  {
    id: 'demo-rifa-padre',
    creator_id: 'google-mariafundaciongmailcom',
    creator_email: 'maria.fundacion@gmail.com',
    creator_name: 'María Luz (Fundación Solidaria)',
    title: 'Super Rifa Día del Padre',
    subtitle: 'Sorteo solidario para la compra de equipamiento médico',
    beneficiary: 'Fundación de Salud Pediátrica San Roque',
    whatsapp_phone: '+5491123456789',
    payment_alias: 'sanroque.salud.mp',
    ticket_value: 5000,
    draw_date: '2026-06-19',
    draw_method: 'Lotería Nacional Nocturna',
    total_numbers: 100,
    prizes: [
      { id: 1, name: '1° Premio: Perfume original Messi 100ml' },
      { id: 2, name: '2° Premio: Pelota de fútbol oficial AFA' },
      { id: 3, name: '3° Premio: Perfume One Million 50ml' }
    ],
    // 0 = Free, 1 = Reserved, 2 = Paid
    numbers_state: {
      '2': 2, '5': 1, '10': 2, '12': 2, '13': 2, '14': 2, '17': 2, '19': 2, '33': 2, '42': 2, '78': 2, '79': 1, '91': 2, '100': 2
    },
    reports_count: 0,
    created_at: new Date('2026-06-01').toISOString(),
  },
  {
    id: 'demo-rifa-bomberos',
    creator_id: 'google-carlosbomberogmailcom',
    creator_email: 'carlos.bombero@gmail.com',
    creator_name: 'Carlos Gómez (Bomberos Voluntarios)',
    title: 'Rifa Anual Bomberos Voluntarios',
    subtitle: 'Ayudanos a equipar nuestro nuevo camión de rescate',
    beneficiary: 'Cuerpo de Bomberos de San Martín',
    whatsapp_phone: '+5493519876543',
    payment_alias: 'bomberos.sanmartin.cbu',
    ticket_value: 3000,
    draw_date: '2026-07-10',
    draw_method: 'Sorteador Digital Interno de la App',
    total_numbers: 50,
    prizes: [
      { id: 1, name: '1° Premio: Bicicleta Mountain Bike R29' },
      { id: 2, name: '2° Premio: Voucher de Compra por $50.000' }
    ],
    numbers_state: {
      '1': 2, '2': 1, '15': 2, '25': 2, '30': 1, '45': 2, '48': 2
    },
    reports_count: 0,
    created_at: new Date('2026-06-05').toISOString(),
  }
];

export const DatabaseProvider = ({ children }) => {
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);

  const cleanExpiredReservations = (rafflesList) => {
    let changed = false;
    const now = new Date();
    const cleanedList = rafflesList.map(raffle => {
      let raffleChanged = false;
      const updatedNumbersState = { ...raffle.numbers_state };

      for (const ticket in updatedNumbersState) {
        const info = updatedNumbersState[ticket];
        if (info && typeof info === 'object' && info.status === 1 && info.reserved_at) {
          const reservedTime = new Date(info.reserved_at);
          if (now - reservedTime > 24 * 60 * 60 * 1000) {
            delete updatedNumbersState[ticket];
            raffleChanged = true;
            changed = true;
          }
        }
      }

      if (raffleChanged) {
        return {
          ...raffle,
          numbers_state: updatedNumbersState
        };
      }
      return raffle;
    });

    if (changed) {
      localStorage.setItem('rifasolidaria_raffles', JSON.stringify(cleanedList));
    }
    return cleanedList;
  };

  // Initialize DB from localStorage or defaults
  useEffect(() => {
    const stored = localStorage.getItem('rifasolidaria_raffles');
    let initialList = [];
    if (stored) {
      initialList = JSON.parse(stored);
    } else {
      initialList = INITIAL_MOCK_RAFFLES;
      localStorage.setItem('rifasolidaria_raffles', JSON.stringify(INITIAL_MOCK_RAFFLES));
    }
    const cleaned = cleanExpiredReservations(initialList);
    setRaffles(cleaned);
    setLoading(false);
  }, []);

  const simulateDelay = () => new Promise((resolve) => setTimeout(resolve, 300));

  const getAllRaffles = async () => {
    setLoading(true);
    await simulateDelay();
    setLoading(false);
    const cleaned = cleanExpiredReservations(raffles);
    if (JSON.stringify(cleaned) !== JSON.stringify(raffles)) {
      setRaffles(cleaned);
    }
    return cleaned;
  };

  const getRaffleById = async (id) => {
    setLoading(true);
    await simulateDelay();
    setLoading(false);
    const cleaned = cleanExpiredReservations(raffles);
    if (JSON.stringify(cleaned) !== JSON.stringify(raffles)) {
      setRaffles(cleaned);
    }
    const found = cleaned.find(r => r.id === id);
    return found ? { ...found } : null;
  };

  const createRaffle = async (raffleData, user) => {
    if (!user) throw new Error('Debe iniciar sesión para crear una rifa.');
    
    setLoading(true);
    await simulateDelay();
    
    const newRaffle = {
      id: `rifa-${Math.random().toString(36).substring(2, 11)}`,
      creator_id: user.id,
      creator_email: user.email,
      creator_name: user.displayName,
      title: raffleData.title,
      subtitle: raffleData.subtitle,
      beneficiary: raffleData.beneficiary,
      whatsapp_phone: raffleData.whatsapp_phone,
      payment_alias: raffleData.payment_alias,
      ticket_value: Number(raffleData.ticket_value),
      draw_date: raffleData.draw_date,
      draw_type: raffleData.draw_type || 'external',
      draw_method: raffleData.draw_method || 'Sorteador Interno',
      draw_moment: raffleData.draw_moment || '',
      total_numbers: Number(raffleData.total_numbers) || 100,
      ticket_type: raffleData.ticket_type || 'sequential',
      custom_tickets: raffleData.custom_tickets || null,
      prizes: raffleData.prizes || [],
      numbers_state: {}, // Empty means all 0 (Free)
      winning_number: null,
      reports_count: 0,
      created_at: new Date().toISOString(),
    };

    const updated = [newRaffle, ...raffles];
    localStorage.setItem('rifasolidaria_raffles', JSON.stringify(updated));
    setRaffles(updated);
    setLoading(false);
    return newRaffle;
  };

  const updateRaffleNumbers = async (raffleId, numbersState, user) => {
    if (!user) throw new Error('Debe iniciar sesión para realizar cambios.');
    
    setLoading(true);
    await simulateDelay();

    const raffleIndex = raffles.findIndex(r => r.id === raffleId);
    if (raffleIndex === -1) {
      setLoading(false);
      throw new Error('Rifa no encontrada.');
    }

    const raffle = raffles[raffleIndex];
    
    // Security Verification: Check ownership
    if (raffle.creator_id !== user.id) {
      setLoading(false);
      throw new Error('No estás autorizado para modificar los números de esta rifa.');
    }

    const updatedRaffles = [...raffles];
    updatedRaffles[raffleIndex] = {
      ...raffle,
      numbers_state: numbersState
    };

    localStorage.setItem('rifasolidaria_raffles', JSON.stringify(updatedRaffles));
    setRaffles(updatedRaffles);
    setLoading(false);
    return updatedRaffles[raffleIndex];
  };

  const updateRaffleWinner = async (raffleId, winningNumber, user) => {
    if (!user) throw new Error('Debe iniciar sesión para registrar el ganador.');

    setLoading(true);
    await simulateDelay();

    const raffleIndex = raffles.findIndex(r => r.id === raffleId);
    if (raffleIndex === -1) {
      setLoading(false);
      throw new Error('Rifa no encontrada.');
    }

    const raffle = raffles[raffleIndex];
    if (raffle.creator_id !== user.id) {
      setLoading(false);
      throw new Error('No estás autorizado para actualizar esta rifa.');
    }

    const updatedRaffles = [...raffles];
    updatedRaffles[raffleIndex] = {
      ...raffle,
      winning_number: winningNumber // Can be number or null
    };

    localStorage.setItem('rifasolidaria_raffles', JSON.stringify(updatedRaffles));
    setRaffles(updatedRaffles);
    setLoading(false);
    return updatedRaffles[raffleIndex];
  };

  const registerParticipantNumber = async (raffleId, number, participantName) => {
    setLoading(true);
    await simulateDelay();

    const raffleIndex = raffles.findIndex(r => r.id === raffleId);
    if (raffleIndex === -1) {
      setLoading(false);
      throw new Error('Rifa no encontrada.');
    }

    const raffle = raffles[raffleIndex];

    // Security check: Only internal (free) raffles allow direct public registration
    if (raffle.draw_type !== 'internal') {
      setLoading(false);
      throw new Error('Esta rifa requiere pago externo. Por favor, solicita la reserva por WhatsApp.');
    }

    // Validate name & filter bad words
    const validation = validateParticipantName(participantName);
    if (!validation.isValid) {
      setLoading(false);
      throw new Error(validation.error);
    }

    const numKey = String(number);
    const existing = raffle.numbers_state[numKey];
    if (existing) {
      setLoading(false);
      throw new Error('Este número ya fue seleccionado por otra persona.');
    }

    const updatedRaffles = [...raffles];
    const updatedNumbersState = { ...raffle.numbers_state };
    
    updatedNumbersState[numKey] = {
      status: 2, // Taken/Reserved
      name: validation.cleanName,
      paid_at: new Date().toISOString()
    };

    updatedRaffles[raffleIndex] = {
      ...raffle,
      numbers_state: updatedNumbersState
    };

    localStorage.setItem('rifasolidaria_raffles', JSON.stringify(updatedRaffles));
    setRaffles(updatedRaffles);
    setLoading(false);
    return updatedRaffles[raffleIndex];
  };

  const reportRaffle = async (raffleId) => {
    await simulateDelay();
    const raffleIndex = raffles.findIndex(r => r.id === raffleId);
    if (raffleIndex === -1) return;

    const updatedRaffles = [...raffles];
    const currentReports = updatedRaffles[raffleIndex].reports_count || 0;
    
    updatedRaffles[raffleIndex] = {
      ...updatedRaffles[raffleIndex],
      reports_count: currentReports + 1
    };

    localStorage.setItem('rifasolidaria_raffles', JSON.stringify(updatedRaffles));
    setRaffles(updatedRaffles);
  };

  const updateRaffle = async (raffleId, updatedFields, user) => {
    if (!user) throw new Error('Debe iniciar sesión para modificar una rifa.');
    
    setLoading(true);
    await simulateDelay();

    const raffleIndex = raffles.findIndex(r => r.id === raffleId);
    if (raffleIndex === -1) {
      setLoading(false);
      throw new Error('Rifa no encontrada.');
    }

    const raffle = raffles[raffleIndex];
    if (raffle.creator_id !== user.id) {
      setLoading(false);
      throw new Error('No estás autorizado para actualizar esta rifa.');
    }

    const updatedRaffles = [...raffles];
    updatedRaffles[raffleIndex] = {
      ...raffle,
      title: updatedFields.title ?? raffle.title,
      subtitle: updatedFields.subtitle ?? raffle.subtitle,
      beneficiary: updatedFields.beneficiary ?? raffle.beneficiary,
      prizes: updatedFields.prizes ?? raffle.prizes
    };

    localStorage.setItem('rifasolidaria_raffles', JSON.stringify(updatedRaffles));
    setRaffles(updatedRaffles);
    setLoading(false);
    return updatedRaffles[raffleIndex];
  };

  const deleteRaffle = async (raffleId, user) => {
    if (!user) throw new Error('Debe iniciar sesión para borrar una rifa.');
    
    setLoading(true);
    await simulateDelay();

    const raffle = raffles.find(r => r.id === raffleId);
    if (!raffle) {
      setLoading(false);
      return;
    }

    if (raffle.creator_id !== user.id) {
      setLoading(false);
      throw new Error('No estás autorizado para borrar esta rifa.');
    }

    // Restriction check for external raffles
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
          setLoading(false);
          throw new Error('No se puede eliminar un sorteo externo con números pagados antes de la fecha del sorteo para proteger a los participantes.');
        }
      }
    }

    const filtered = raffles.filter(r => r.id !== raffleId);
    localStorage.setItem('rifasolidaria_raffles', JSON.stringify(filtered));
    setRaffles(filtered);
    setLoading(false);
  };

  return (
    <DatabaseContext.Provider value={{
      raffles,
      loading,
      getAllRaffles,
      getRaffleById,
      createRaffle,
      updateRaffleNumbers,
      updateRaffleWinner,
      updateRaffle,
      registerParticipantNumber,
      reportRaffle,
      deleteRaffle
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
