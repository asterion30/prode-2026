import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { ArrowLeft, Save, Plus, Trash2, HelpCircle, Image as ImageIcon, Upload, X as CloseIcon } from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';

export const CreateRaffle = ({ onNavigate }) => {
  const { user } = useAuth();
  const { createRaffle } = useDatabase();

  useEffect(() => {
    if (!user) {
      onNavigate('home');
    }
  }, [user]);

  // Wizard Step State
  const [step, setStep] = useState(1);

  // Form states
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [paymentAlias, setPaymentAlias] = useState('');
  const [ticketValue, setTicketValue] = useState('');
  const [drawDate, setDrawDate] = useState('');
  const [drawType, setDrawType] = useState('external'); // 'internal' or 'external'
  const [drawMethod, setDrawMethod] = useState('Lotería Nacional');
  const [drawMethodCustom, setDrawMethodCustom] = useState('');
  const [drawMoment, setDrawMoment] = useState('Nocturna');
  const [totalNumbers, setTotalNumbers] = useState('100');
  const [customTotalNumbers, setCustomTotalNumbers] = useState('150');
  const [ticketType, setTicketType] = useState('sequential'); // 'sequential' or 'custom'
  const [customTicketsInput, setCustomTicketsInput] = useState('');
  const [customSeparator, setCustomSeparator] = useState(',');
  const [uploadedFileContent, setUploadedFileContent] = useState('');
  
  // Reset financial fields when drawType changes
  useEffect(() => {
    if (drawType === 'internal') {
      setTicketValue('0');
      setPaymentAlias('Gratuito');
      setWhatsappPhone('N/A');
    } else {
      if (ticketValue === '0') setTicketValue('');
      if (paymentAlias === 'Gratuito') setPaymentAlias('');
      if (whatsappPhone === 'N/A') setWhatsappPhone('');
    }
  }, [drawType]);
  
  // Prizes list (starts with 1 empty prize)
  const [prizes, setPrizes] = useState([
    { id: 1, name: '', image: null }
  ]);
  const [imageLoadingMap, setImageLoadingMap] = useState({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleAddPrize = () => {
    setPrizes([...prizes, { id: Date.now(), name: '', image: null }]);
  };

  const handleRemovePrize = (id) => {
    if (prizes.length === 1) return; // Keep at least one
    setPrizes(prizes.filter(p => p.id !== id));
  };

  const handlePrizeChange = (id, val) => {
    setPrizes(prizes.map(p => p.id === id ? { ...p, name: val } : p));
  };

  const handleImageUpload = async (prizeId, file) => {
    if (!file) return;

    setImageLoadingMap(prev => ({ ...prev, [prizeId]: true }));
    try {
      const compressedBase64 = await compressImage(file, 800, 800, 0.7);
      setPrizes(prizes.map(p => p.id === prizeId ? { ...p, image: compressedBase64 } : p));
    } catch (err) {
      alert(err.message || 'Error al procesar la imagen.');
    } finally {
      setImageLoadingMap(prev => ({ ...prev, [prizeId]: false }));
    }
  };

  const handleRemoveImage = (prizeId) => {
    setPrizes(prizes.map(p => p.id === prizeId ? { ...p, image: null } : p));
  };

  const parseAndPopulateTickets = (rawContent, separator) => {
    let splitChar = separator;
    if (separator === '\\n') splitChar = '\n';
    if (separator === '\\t') splitChar = '\t';

    const items = [];
    const lines = rawContent.split('\n');
    for (const line of lines) {
      const parts = line.split(splitChar).map(p => p.trim()).filter(p => p !== '');
      items.push(...parts);
    }

    setCustomTicketsInput(items.join(', '));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      setUploadedFileContent(text);
      parseAndPopulateTickets(text, customSeparator);
    };
    reader.readAsText(file);
  };

  const handleSeparatorChange = (newSeparator) => {
    setCustomSeparator(newSeparator);
    if (uploadedFileContent) {
      parseAndPopulateTickets(uploadedFileContent, newSeparator);
    }
  };

  // Step-by-Step Validation Logic
  const validateStep = (currentStep) => {
    setError('');
    
    if (currentStep === 1) {
      if (!title.trim()) {
        setError('El título de la rifa es obligatorio.');
        return false;
      }
      if (!subtitle.trim()) {
        setError('El subtítulo o copete es obligatorio.');
        return false;
      }
    }
    
    if (currentStep === 2) {
      if (drawType === 'external') {
        const val = Number(ticketValue);
        if (ticketValue === '' || isNaN(val) || val < 0) {
          setError('El valor del número debe ser mayor o igual a 0.');
          return false;
        }
        if (!paymentAlias.trim()) {
          setError('El alias de pago (CBU/CVU) es obligatorio.');
          return false;
        }
        if (!whatsappPhone.trim()) {
          setError('El teléfono de WhatsApp para reservas es obligatorio.');
          return false;
        }
      }
      
      if (drawType === 'internal' && ticketType === 'custom') {
        let splitChar = customSeparator;
        if (customSeparator === '\\n') splitChar = '\n';
        if (customSeparator === '\\t') splitChar = '\t';

        const items = [];
        const lines = customTicketsInput.split('\n');
        for (const line of lines) {
          const parts = line.split(splitChar);
          for (const p of parts) {
            const subparts = splitChar === ',' ? [p] : p.split(',');
            for (const sp of subparts) {
              const trimmed = sp.trim();
              if (trimmed !== '') {
                items.push(trimmed);
              }
            }
          }
        }

        if (items.length < 2) {
          setError('Debes ingresar al menos 2 identificadores.');
          return false;
        }
        if (items.length > 1000) {
          setError('El máximo de identificadores permitido es 1000.');
          return false;
        }

        const digitRegex = /^\d{1,8}$/;
        for (const item of items) {
          if (!digitRegex.test(item)) {
            setError(`El identificador "${item}" no es válido. Debe contener únicamente números (sin letras o símbolos) y tener un máximo de 8 dígitos.`);
            return false;
          }
        }

        const uniqueItems = Array.from(new Set(items));
        if (uniqueItems.length !== items.length) {
          setError('No se permiten identificadores duplicados en la lista.');
          return false;
        }
      } else {
        const finalNumbers = totalNumbers === 'custom' ? Number(customTotalNumbers) : Number(totalNumbers);
        if (isNaN(finalNumbers) || finalNumbers < 10 || finalNumbers > 1000) {
          setError('El total de números debe estar entre 10 y 1000.');
          return false;
        }
      }
    }
    
    if (currentStep === 3) {
      if (!drawDate) {
        setError('Debes especificar la fecha del sorteo.');
        return false;
      }
      
      if (drawType === 'external') {
        const method = drawMethod === 'custom' ? drawMethodCustom : drawMethod;
        if (!method.trim()) {
          setError('Debes especificar la lotería o sorteador del sorteo.');
          return false;
        }
        if (!drawMoment.trim()) {
          setError('Debes especificar el turno o momento del sorteo.');
          return false;
        }
      }
    }
    
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('Debes iniciar sesión con Google.');
      return;
    }

    // Double-check validations for all previous steps
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    // Step 4 Validations
    const filteredPrizes = prizes.filter(p => p.name.trim() !== '');
    if (filteredPrizes.length === 0) {
      setError('Debes agregar al menos un premio.');
      return;
    }

    if (!acceptedTerms) {
      setError('Debes aceptar los términos y el descargo legal de responsabilidad.');
      return;
    }

    setSaving(true);

    let parsedTickets = null;
    let finalTotalNumbers = 0;

    if (drawType === 'internal' && ticketType === 'custom') {
      let splitChar = customSeparator;
      if (customSeparator === '\\n') splitChar = '\n';
      if (customSeparator === '\\t') splitChar = '\t';

      const items = [];
      const lines = customTicketsInput.split('\n');
      for (const line of lines) {
        const parts = line.split(splitChar);
        for (const p of parts) {
          const subparts = splitChar === ',' ? [p] : p.split(',');
          for (const sp of subparts) {
            const trimmed = sp.trim();
            if (trimmed !== '') {
              items.push(trimmed);
            }
          }
        }
      }
      parsedTickets = items;
      finalTotalNumbers = items.length;
    } else {
      finalTotalNumbers = totalNumbers === 'custom' ? Number(customTotalNumbers) : Number(totalNumbers);
    }

    let finalDrawMethod = '';
    let finalDrawMoment = '';
    let finalWhatsappPhone = '';
    let finalPaymentAlias = '';
    let finalTicketValue = 0;

    if (drawType === 'internal') {
      finalDrawMethod = 'Sorteador Digital Interno (App)';
      finalDrawMoment = 'Sorteo Automático';
      finalWhatsappPhone = 'N/A';
      finalPaymentAlias = 'Gratuito';
      finalTicketValue = 0;
    } else {
      finalDrawMethod = drawMethod === 'custom' ? drawMethodCustom : drawMethod;
      finalDrawMoment = drawMoment;
      finalWhatsappPhone = whatsappPhone;
      finalPaymentAlias = paymentAlias;
      finalTicketValue = Number(ticketValue);
    }

    try {
      const created = await createRaffle({
        title,
        subtitle,
        beneficiary,
        whatsapp_phone: finalWhatsappPhone,
        payment_alias: finalPaymentAlias,
        ticket_value: finalTicketValue,
        draw_date: drawDate,
        draw_type: drawType,
        draw_method: finalDrawMethod,
        draw_moment: finalDrawMoment,
        total_numbers: finalTotalNumbers,
        ticket_type: drawType === 'internal' ? ticketType : 'sequential',
        custom_tickets: parsedTickets,
        prizes: filteredPrizes.map((p, index) => ({ id: index + 1, name: p.name, image: p.image || null }))
      }, user);

      onNavigate('detail', created.id);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al guardar la rifa. Por favor intente nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Back Button and Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
        <button
          onClick={() => onNavigate('dashboard')}
          className="btn btn-secondary"
          style={{ padding: '0.5rem', borderRadius: '50%' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'white' }}>Crear Rifa Benéfica</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Completá los datos paso a paso
          </p>
        </div>
      </div>

      {/* Wizard Step Indicator */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.05)',
        marginBottom: '0.25rem'
      }}>
        {[1, 2, 3, 4].map(s => {
          const isCompleted = step > s;
          const isActive = step === s;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < 4 ? '1 1 auto' : '0 0 auto' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: isActive 
                  ? 'var(--color-bright)' 
                  : isCompleted 
                    ? 'rgba(34, 197, 94, 0.2)' 
                    : 'rgba(255,255,255,0.05)',
                border: isActive 
                  ? '2px solid white' 
                  : isCompleted 
                    ? '1.5px solid rgb(34, 197, 94)' 
                    : '1px solid rgba(255,255,255,0.12)',
                color: isCompleted ? 'rgb(34, 197, 94)' : 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                transition: 'all 0.3s'
              }}>
                {isCompleted ? '✓' : s}
              </div>
              {s < 4 && (
                <div style={{
                  flex: 1,
                  height: '2px',
                  background: isCompleted ? 'rgb(34, 197, 94)' : 'rgba(255,255,255,0.08)',
                  margin: '0 0.5rem',
                  transition: 'background 0.3s'
                }}></div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--color-bright)', fontWeight: 'bold' }}>
        Paso {step} de 4: {
          step === 1 ? 'Información Principal' :
          step === 2 ? 'Configuración y Finanzas' :
          step === 3 ? 'Tipo de Sorteo' :
          'Premios y Confirmación'
        }
      </div>

      {error && (
        <div style={{
          padding: '0.85rem 1rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          color: 'var(--color-danger)',
          fontSize: '0.85rem',
          textAlign: 'left',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Step 1: Información Principal */}
        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
            <div className="form-group">
              <label className="form-label">Título de la Rifa</label>
              <input
                type="text"
                placeholder="Ej: Gran Rifa Solidaria Día del Padre"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-control"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Subtítulo o Copete</label>
              <input
                type="text"
                placeholder="Ej: Sortea el 19 de junio - valor $5.000"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="form-control"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Causa o Beneficiario (Opcional)</label>
              <input
                type="text"
                placeholder="Ej: Cooperadora Hospital Infantil / Tratamiento de Salud de Juan"
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                className="form-control"
              />
            </div>
          </div>
        )}

        {/* Step 2: Configuración y Finanzas */}
        {step === 2 && (
          <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
            {drawType === 'external' ? (
              <>
                <div className="form-group">
                  <label className="form-label">Valor del Número ($)</label>
                  <input
                    type="number"
                    placeholder="Ej: 5000"
                    value={ticketValue}
                    onChange={(e) => setTicketValue(e.target.value)}
                    className="form-control"
                    min="0"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '0.55rem' }}>Total de Números</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {['50', '100', '200', '500', '1000', 'custom'].map(range => {
                      const isActive = totalNumbers === range;
                      const label = range === 'custom' ? 'Personalizado' : range;
                      return (
                        <button
                          key={range}
                          type="button"
                          onClick={() => setTotalNumbers(range)}
                          style={{
                            flex: '1 1 calc(33.33% - 0.5rem)',
                            minWidth: '80px',
                            padding: '0.55rem 0.5rem',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            background: isActive ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            border: isActive ? '1.5px solid var(--color-bright)' : '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '8px',
                            color: isActive ? 'white' : 'var(--color-text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {totalNumbers === 'custom' && (
                  <div className="form-group" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <label className="form-label">Cantidad de Números Personalizada</label>
                    <input
                      type="number"
                      placeholder="Cantidad de números (10 a 1000)"
                      value={customTotalNumbers}
                      onChange={(e) => setCustomTotalNumbers(e.target.value)}
                      className="form-control"
                      min="10"
                      max="1000"
                      required
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                      Ingresa cualquier valor entero entre 10 y 1000.
                    </span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Alias de Pago (CVU / Alias MP)</label>
                  <input
                    type="text"
                    placeholder="Ej: cooperadora.hospital.mp"
                    value={paymentAlias}
                    onChange={(e) => setPaymentAlias(e.target.value)}
                    className="form-control"
                    required
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Los participantes transferirán directo a este alias para comprar su número.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Teléfono de WhatsApp (con código de país)</label>
                  <input
                    type="tel"
                    placeholder="Ej: +5491123456789"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    className="form-control"
                    required
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Debe incluir el código de país (ej. +549 para Argentina celular).
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Tipo de Números / Participantes</label>
                  <select
                    value={ticketType}
                    onChange={(e) => setTicketType(e.target.value)}
                    className="form-control"
                    style={{ background: 'rgba(10, 15, 45, 0.8)' }}
                  >
                    <option value="sequential">Secuencial Numérico (Ej: 1 al 100, 1 al 1000)</option>
                    <option value="custom">Lista de Identificadores (DNIs, Legajos, Libretas)</option>
                  </select>
                </div>

                {ticketType === 'sequential' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label" style={{ marginBottom: '0.55rem' }}>Total de Números</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {['50', '100', '200', '500', '1000', 'custom'].map(range => {
                          const isActive = totalNumbers === range;
                          const label = range === 'custom' ? 'Personalizado' : range;
                          return (
                            <button
                              key={range}
                              type="button"
                              onClick={() => setTotalNumbers(range)}
                              style={{
                                flex: '1 1 calc(33.33% - 0.5rem)',
                                minWidth: '80px',
                                padding: '0.55rem 0.5rem',
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                background: isActive ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                border: isActive ? '1.5px solid var(--color-bright)' : '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: '8px',
                                color: isActive ? 'white' : 'var(--color-text-muted)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {totalNumbers === 'custom' && (
                      <div className="form-group" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                        <label className="form-label">Cantidad de Números Personalizada</label>
                        <input
                          type="number"
                          placeholder="Cantidad de números (10 a 1000)"
                          value={customTotalNumbers}
                          onChange={(e) => setCustomTotalNumbers(e.target.value)}
                          className="form-control"
                          min="10"
                          max="1000"
                          required
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                          Ingresa cualquier valor entero entre 10 y 1000.
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="form-group" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <label className="form-label">Lista de Identificadores (Hasta 8 dígitos c/u)</label>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.75rem',
                      marginBottom: '0.75rem',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>
                          Cargar Archivo (.txt, .csv)
                        </label>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(37, 99, 235, 0.15)',
                          border: '1px solid var(--border-glow)',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          color: 'white',
                          fontWeight: '700',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s'
                        }}>
                          <Upload size={14} />
                          Subir Archivo
                          <input
                            type="file"
                            accept=".txt,.csv"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>
                          Separador de Datos
                        </label>
                        <select
                          value={customSeparator}
                          onChange={(e) => handleSeparatorChange(e.target.value)}
                          className="form-control"
                          style={{ fontSize: '0.75rem', padding: '0.45rem 0.5rem', height: '100%', minHeight: '34px', background: 'rgba(10, 15, 45, 0.8)' }}
                        >
                          <option value=",">Coma ( , )</option>
                          <option value=";">Punto y coma ( ; )</option>
                          <option value="\n">Salto de línea</option>
                          <option value=" ">Espacio</option>
                          <option value="\t">Tabulador</option>
                        </select>
                      </div>
                    </div>

                    <textarea
                      placeholder="Ej: 1002, 1005, 1010, 489201, 992014&#10;Ingresa un número por línea o separados por el carácter elegido."
                      value={customTicketsInput}
                      onChange={(e) => setCustomTicketsInput(e.target.value)}
                      className="form-control"
                      rows="4"
                      style={{ background: 'rgba(10, 15, 45, 0.8)', resize: 'vertical', fontFamily: 'monospace' }}
                      required
                    ></textarea>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                      Cada número ingresado (máx. 8 dígitos) representará un casillero en la grilla del sorteo presencial.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Tipo de Sorteo */}
        {step === 3 && (
          <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
            <div className="form-group">
              <label className="form-label">Tipo de Sorteo</label>
              <select
                value={drawType}
                onChange={(e) => setDrawType(e.target.value)}
                className="form-control"
                style={{ background: 'rgba(10, 15, 45, 0.8)' }}
              >
                <option value="external">Sorteo Externo (Loterías Oficiales)</option>
                <option value="internal">Sorteador Digital Interno (Automatizado en la App)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Fecha del Sorteo</label>
              <input
                type="date"
                value={drawDate}
                onChange={(e) => setDrawDate(e.target.value)}
                className="form-control"
                required
              />
            </div>

            {drawType === 'external' ? (
              <>
                <div className="form-group">
                  <label className="form-label">Lotería / Organizador del Sorteo</label>
                  <select
                    value={drawMethod}
                    onChange={(e) => setDrawMethod(e.target.value)}
                    className="form-control"
                    style={{ background: 'rgba(10, 15, 45, 0.8)' }}
                  >
                    <option value="Lotería Nacional">Lotería Nacional (Argentina)</option>
                    <option value="Lotería de la Provincia">Lotería de la Provincia de Bs. As.</option>
                    <option value="Lotería de la Ciudad">Lotería de la Ciudad (CABA)</option>
                    <option value="Lotería de Córdoba">Lotería de Córdoba</option>
                    <option value="Lotería de Santa Fe">Lotería de Santa Fe</option>
                    <option value="custom">Otro (Especificar)</option>
                  </select>
                </div>

                {drawMethod === 'custom' && (
                  <div className="form-group" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <label className="form-label">Nombre del Sorteador / Lotería Personalizada</label>
                    <input
                      type="text"
                      placeholder="Ej: Lotería de Montevideo, Quiniela de Corrientes"
                      value={drawMethodCustom}
                      onChange={(e) => setDrawMethodCustom(e.target.value)}
                      className="form-control"
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Turno o Momento del Sorteo</label>
                  <input
                    type="text"
                    placeholder="Ej: Nocturna (21:00 hs), Vespertina, o al finalizar la transmisión"
                    value={drawMoment}
                    onChange={(e) => setDrawMoment(e.target.value)}
                    className="form-control"
                    required
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Especifica en qué turno o momento se realizará el sorteo (por ejemplo: Nocturna, Matutina, etc.).
                  </span>
                </div>
              </>
            ) : (
              <div style={{
                background: 'rgba(56, 189, 248, 0.05)',
                border: '1px dashed var(--border-glow)',
                padding: '1rem',
                borderRadius: '12px',
                fontSize: '0.8rem',
                color: 'var(--color-text-muted)',
                marginBottom: '1rem',
                lineHeight: '1.4'
              }}>
                ✨ El sorteo se realizará de forma automática utilizando el **Sorteador Digital Integrado** de la aplicación. En la fecha fijada, el sistema te permitirá elegir al azar un ganador entre todos los números que registres como **PAGADOS**.
              </div>
            )}
          </div>
        )}

        {/* Step 4: Premios */}
        {step === 4 && (
          <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.35rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--color-bright)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                Premios
              </h3>
              <button
                type="button"
                onClick={handleAddPrize}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', gap: '0.25rem', borderRadius: '8px' }}
              >
                <Plus size={14} />
                Agregar
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {prizes.map((prize, idx) => (
                <div key={prize.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', width: '45px', fontWeight: '700' }}>
                      {idx + 1}° P.
                    </span>
                    <input
                      type="text"
                      placeholder="Ej: Perfume original Messi 100ml / Canasta Familiar"
                      value={prize.name}
                      onChange={(e) => handlePrizeChange(prize.id, e.target.value)}
                      className="form-control"
                      style={{ flex: 1 }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePrize(prize.id)}
                      disabled={prizes.length === 1}
                      className="btn btn-danger"
                      style={{ padding: '0.65rem', borderRadius: '10px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Image upload preview/button area */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '45px' }}>
                    {imageLoadingMap[prize.id] ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--color-bright)' }}>
                        <div className="loader" style={{ width: '14px', height: '14px', borderTopColor: 'white' }}></div>
                        Optimizando Imagen...
                      </div>
                    ) : prize.image ? (
                      <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '8px', border: '1px solid var(--border-glow-active)', overflow: 'hidden' }}>
                        <img src={prize.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(prize.id)}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            background: 'rgba(239, 68, 68, 0.85)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <CloseIcon size={10} />
                        </button>
                      </div>
                    ) : (
                      <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.35rem 0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px dashed rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}>
                        <Upload size={12} />
                        Subir foto del premio
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(prize.id, e.target.files[0])}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Section: Disclaimers and Terms */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', marginTop: '1rem' }}>
              <label style={{ display: 'flex', gap: '0.75rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>
                  Declaro que esta rifa se realiza sin fines de lucro comercial (para ayuda solidaria, comunitaria, educativa o de salud), y que los premios consisten en productos o servicios y <strong>no en sumas de dinero en efectivo</strong>. Acepto que soy el único responsable civil y legal del evento ante las normativas de mi jurisdicción.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Navigation / Actions Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Atrás
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              Siguiente
            </button>
          ) : (
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ flex: 1, gap: '0.5rem' }}
            >
              {saving ? (
                <>
                  <div className="loader" style={{ width: '16px', height: '16px', borderTopColor: 'white' }}></div>
                  Creando Rifa...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Guardar Rifa
                </>
              )}
            </button>
          )}
        </div>

      </form>
    </div>
  );
};
