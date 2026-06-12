import React, { createContext, useContext, useState, useEffect } from 'react';
import { validateParticipantName } from '../utils/profanityFilter';
import { supabase } from '../utils/supabaseClient';

const DatabaseContext = createContext(null);

export const DatabaseProvider = ({ children }) => {
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);

  const cleanExpiredReservations = async (rafflesList) => {
    let changed = false;
    const now = new Date();
    const cleanedList = [];

    for (const raffle of rafflesList) {
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
        // Update this raffle in Supabase silently
        const { error } = await supabase
          .from('raffles')
          .update({ numbers_state: updatedNumbersState })
          .eq('id', raffle.id);
        
        if (!error) {
          cleanedList.push({
            ...raffle,
            numbers_state: updatedNumbersState
          });
        } else {
          cleanedList.push(raffle);
        }
      } else {
        cleanedList.push(raffle);
      }
    }

    return { cleanedList, changed };
  };

  // Initialize DB from Supabase on mount
  useEffect(() => {
    const initFetch = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('raffles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const { cleanedList } = await cleanExpiredReservations(data || []);
        setRaffles(cleanedList);
      } catch (err) {
        console.error('Error fetching raffles:', err.message);
      } finally {
        setLoading(false);
      }
    };
    initFetch();
  }, []);

  const getAllRaffles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('raffles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { cleanedList } = await cleanExpiredReservations(data || []);
      setRaffles(cleanedList);
      setLoading(false);
      return cleanedList;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const getRaffleById = async (id) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('raffles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const { cleanedList } = await cleanExpiredReservations([data]);
      const updatedRaffle = cleanedList[0];

      // Update state locally if it was changed
      setRaffles(prev => prev.map(r => r.id === id ? updatedRaffle : r));
      setLoading(false);
      return updatedRaffle;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const createRaffle = async (raffleData, user) => {
    if (!user) throw new Error('Debe iniciar sesión para crear una rifa.');
    
    setLoading(true);
    try {
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
        numbers_state: {},
        winning_number: null,
        reports_count: 0
      };

      const { data, error } = await supabase
        .from('raffles')
        .insert(newRaffle)
        .select()
        .single();

      if (error) throw error;

      setRaffles(prev => [data, ...prev]);
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const updateRaffleNumbers = async (raffleId, numbersState, user) => {
    if (!user) throw new Error('Debe iniciar sesión para realizar cambios.');
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('raffles')
        .update({ numbers_state: numbersState })
        .eq('id', raffleId)
        .select()
        .single();

      if (error) throw error;

      setRaffles(prev => prev.map(r => r.id === raffleId ? data : r));
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const updateRaffleWinner = async (raffleId, updatedPrizes, user, updatedNumbersState = null) => {
    if (!user) throw new Error('Debe iniciar sesión para registrar el ganador.');

    // For backwards compatibility, set the main winning_number to the first prize's winning number if any
    const firstPrizeWinningNumber = updatedPrizes && updatedPrizes.length > 0 ? updatedPrizes[0].winning_number : null;

    setLoading(true);
    try {
      const updateData = { 
        prizes: updatedPrizes,
        winning_number: firstPrizeWinningNumber || null
      };

      if (updatedNumbersState) {
        updateData.numbers_state = updatedNumbersState;
      }

      const { data, error } = await supabase
        .from('raffles')
        .update(updateData)
        .eq('id', raffleId)
        .select()
        .single();

      if (error) throw error;

      setRaffles(prev => prev.map(r => r.id === raffleId ? data : r));
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const registerParticipantNumber = async (raffleId, number, participantName) => {
    setLoading(true);
    try {
      const { data: raffle, error: getErr } = await supabase
        .from('raffles')
        .select('*')
        .eq('id', raffleId)
        .single();

      if (getErr) throw getErr;

      // Security check: Only internal (free) raffles allow direct public registration
      if (raffle.draw_type !== 'internal') {
        throw new Error('Esta rifa requiere pago externo. Por favor, solicita la reserva por WhatsApp.');
      }

      // Validate name & filter bad words
      const validation = validateParticipantName(participantName);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      const numKey = String(number);
      const existing = raffle.numbers_state[numKey];
      if (existing) {
        throw new Error('Este número ya fue seleccionado por otra persona.');
      }

      const updatedNumbersState = { ...raffle.numbers_state };
      updatedNumbersState[numKey] = {
        status: 2,
        name: validation.cleanName,
        paid_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('raffles')
        .update({ numbers_state: updatedNumbersState })
        .eq('id', raffleId)
        .select()
        .single();

      if (error) throw error;

      setRaffles(prev => prev.map(r => r.id === raffleId ? data : r));
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const reportRaffle = async (raffleId) => {
    try {
      const { data: raffle } = await supabase
        .from('raffles')
        .select('reports_count')
        .eq('id', raffleId)
        .single();

      const currentReports = raffle?.reports_count || 0;
      
      const { data, error } = await supabase
        .from('raffles')
        .update({ reports_count: currentReports + 1 })
        .eq('id', raffleId)
        .select()
        .single();

      if (!error) {
        setRaffles(prev => prev.map(r => r.id === raffleId ? data : r));
      }
    } catch (err) {
      console.error('Error reporting raffle:', err.message);
    }
  };

  const updateRaffle = async (raffleId, updatedFields, user) => {
    if (!user) throw new Error('Debe iniciar sesión para modificar una rifa.');
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('raffles')
        .update({
          title: updatedFields.title,
          subtitle: updatedFields.subtitle,
          beneficiary: updatedFields.beneficiary,
          payment_alias: updatedFields.payment_alias,
          whatsapp_phone: updatedFields.whatsapp_phone,
          prizes: updatedFields.prizes
        })
        .eq('id', raffleId)
        .select()
        .single();

      if (error) throw error;

      setRaffles(prev => prev.map(r => r.id === raffleId ? data : r));
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const deleteRaffle = async (raffleId, user) => {
    if (!user) throw new Error('Debe iniciar sesión para borrar una rifa.');
    
    setLoading(true);
    try {
      const { data: raffle, error: getErr } = await supabase
        .from('raffles')
        .select('*')
        .eq('id', raffleId)
        .single();

      if (getErr) throw getErr;

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
            throw new Error('No se puede eliminar un sorteo externo con números pagados antes de la fecha del sorteo para proteger a los participantes.');
          }
        }
      }

      const { error } = await supabase
        .from('raffles')
        .delete()
        .eq('id', raffleId);

      if (error) throw error;

      setRaffles(prev => prev.filter(r => r.id !== raffleId));
      setLoading(false);
    } catch (err) {
      setLoading(false);
      throw err;
    }
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
