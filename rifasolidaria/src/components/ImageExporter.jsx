import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, Sparkles, Share2 } from 'lucide-react';

export const ImageExporter = ({ raffle }) => {
  const [exporting, setExporting] = useState(false);
  const posterRef = useRef(null);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);

    // Give the browser a brief moment to make sure the poster element is fully rendered and styled
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const element = posterRef.current;
      if (!element) {
        throw new Error('Elemento de póster no encontrado');
      }

      // Temporarily make it visible to capture it
      element.style.display = 'block';

      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#030616',
        scale: 2, // Double resolution for high-quality shares
        width: 540,
        height: 960,
        logging: false
      });

      // Hide it back
      element.style.display = 'none';

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `rifa-${raffle.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
      link.href = dataUrl;
      link.click();

      // Open WhatsApp sharing link (same behavior as compartir rifa)
      const shareLink = `${window.location.origin}${window.location.pathname}#/raffle/${raffle.id}`;
      const text = `🔗 Elegí tus números ingresando acá: ${shareLink}`;
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    } catch (err) {
      console.error('Error al exportar imagen:', err);
      alert('Hubo un error al generar la imagen. Por favor, intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  // Render the numbers in the poster grid
  const renderPosterNumbers = () => {
    const cells = [];
    const total = raffle.total_numbers || 100;
    const isCustom = raffle.ticket_type === 'custom';
    
    let ticketsToRender = [];
    if (isCustom && raffle.custom_tickets) {
      ticketsToRender = raffle.custom_tickets.slice(0, Math.min(total, 200));
    } else {
      const limit = Math.min(total, 200);
      for (let i = 1; i <= limit; i++) {
        ticketsToRender.push(String(i));
      }
    }

    for (const ticket of ticketsToRender) {
      const stateVal = raffle.numbers_state[ticket] || 0; // 0=Free, 1=Reserved, 2=Paid
      const status = typeof stateVal === 'object' ? stateVal.status : stateVal;
      let stateClass = 'state-free';
      if (status === 1) stateClass = 'state-reserved';
      if (status === 2) stateClass = 'state-paid';
      
      const fontSize = isCustom
        ? (ticket.length > 6 ? '0.55rem' : '0.65rem')
        : (total > 100 ? '0.65rem' : '0.85rem');
      
      cells.push(
        <div 
          key={ticket} 
          className={`number-cell ${stateClass}`} 
          style={{ 
            width: '100%', 
            height: isCustom ? 'auto' : '100%', 
            pointerEvents: 'none',
            fontSize: fontSize,
            borderRadius: isCustom ? '4px' : (total > 100 ? '4px' : '6px'),
            aspectRatio: isCustom ? '2.2 / 1' : '1 / 1',
            padding: isCustom ? '0.15rem 0.25rem' : '0',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isCustom ? ticket : ticket.padStart(total > 99 ? 3 : 2, '0')}
        </div>
      );
    }
    return cells;
  };

  const total = raffle.total_numbers || 100;
  const soldCount = Object.values(raffle.numbers_state).filter(state => {
    const status = typeof state === 'object' ? state.status : state;
    return status === 2;
  }).length;
  const reservedCount = Object.values(raffle.numbers_state).filter(state => {
    const status = typeof state === 'object' ? state.status : state;
    return status === 1;
  }).length;
  const freeCount = total - soldCount - reservedCount;
  const soldPercent = Math.round(((soldCount + reservedCount) / total) * 100);

  return (
    <div>
      <button onClick={handleExport} disabled={exporting} className="btn btn-primary" style={{ width: '100%', gap: '0.5rem' }}>
        {exporting ? (
          <>
            <div className="loader" style={{ width: '16px', height: '16px', borderTopColor: 'white' }}></div>
            Generando Imagen...
          </>
        ) : (
          <>
            <Share2 size={18} />
            Compartir Tablero
          </>
        )}
      </button>

      {/* Hidden Poster designed specifically for Instagram/WhatsApp Stories (Aspect Ratio 9:16 - 1080x1920 scaled to 540x960 for export) */}
      <div
        ref={posterRef}
        className="export-container"
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '540px',
          height: '960px',
          zIndex: -9999,
          fontFamily: 'var(--font-body)',
          padding: '2.5rem',
          boxSizing: 'border-box'
        }}
      >
        {/* Background stars (simulated for export static view) */}
        <div style={{ position: 'absolute', top: '5%', left: '8%', color: 'rgba(255,255,255,0.4)' }}><Sparkles size={16} /></div>
        <div style={{ position: 'absolute', top: '15%', right: '12%', color: 'rgba(255,255,255,0.4)' }}><Sparkles size={24} /></div>
        <div style={{ position: 'absolute', bottom: '25%', left: '10%', color: 'rgba(255,255,255,0.4)' }}><Sparkles size={20} /></div>
        <div style={{ position: 'absolute', bottom: '10%', right: '8%', color: 'rgba(255,255,255,0.4)' }}><Sparkles size={16} /></div>

        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', zIndex: 2, position: 'relative' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <h1 className="neon-title" style={{ fontSize: '2.4rem', marginBottom: '0.35rem', letterSpacing: '1px', lineHeight: '1.2' }}>
              {raffle.title}
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--color-bright)', fontWeight: '600', marginBottom: '0.85rem', textTransform: 'uppercase' }}>
              {raffle.subtitle}
            </p>
            
            {/* Draw date & Ticket value badge */}
            <div style={{
              display: 'inline-flex',
              flexDirection: 'column',
              background: 'rgba(37, 99, 235, 0.25)',
              border: '1.5px solid var(--color-bright)',
              borderRadius: '16px',
              padding: '0.5rem 1.2rem',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '0.9rem',
              marginBottom: '1rem',
              lineHeight: '1.4'
            }}>
              {raffle.draw_type === 'internal' ? (
                <>
                  <span>Sorteo: Sorteador Digital Interno (App)</span>
                  <span>Fecha: {new Date(raffle.draw_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} - Valor: Gratuito</span>
                </>
              ) : (
                <>
                  <span>Sortea por: {raffle.draw_method} ({raffle.draw_moment || 'Nocturna'})</span>
                  <span>Fecha: {new Date(raffle.draw_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} - Valor: ${Number(raffle.ticket_value).toLocaleString('es-AR')}</span>
                </>
              )}
            </div>
          </div>

          {/* Conditional Rendering of Grid or Circular progress status */}
          {raffle.total_numbers <= 200 ? (
            <div 
              className="raffle-grid" 
              style={{ 
                gridTemplateColumns: raffle.ticket_type === 'custom' 
                  ? 'repeat(auto-fill, minmax(70px, 1fr))' 
                  : (raffle.total_numbers <= 50 ? 'repeat(5, 1fr)' : 'repeat(10, 1fr)'),
                background: 'rgba(10, 20, 60, 0.5)',
                border: '1.5px solid rgba(56, 189, 248, 0.3)',
                padding: raffle.ticket_type === 'custom' ? '0.4rem' : (raffle.total_numbers > 100 ? '0.4rem' : '0.75rem'),
                gap: raffle.ticket_type === 'custom' ? '4px' : (raffle.total_numbers > 100 ? '3px' : '6px'),
                borderRadius: '16px',
                display: raffle.ticket_type === 'custom' ? 'grid' : undefined
              }}
            >
              {renderPosterNumbers()}
            </div>
          ) : (
            <div style={{
              background: 'rgba(10, 20, 60, 0.55)',
              border: '2.5px solid var(--color-bright)',
              borderRadius: '24px',
              padding: '1.75rem 1.5rem',
              textAlign: 'center',
              boxShadow: '0 8px 32px 0 rgba(56, 189, 248, 0.2)'
            }}>
              <p style={{ fontSize: '1.25rem', fontWeight: '800', color: 'white', textTransform: 'uppercase', marginBottom: '1.25rem', letterSpacing: '1px' }}>
                ¡El Sorteo ya está en marcha!
              </p>

              {/* Progress Circle Graphic */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: `conic-gradient(var(--color-bright) ${soldPercent}%, rgba(255,255,255,0.08) 0%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(56, 189, 248, 0.3)'
                }}>
                  <div style={{
                    width: '98px',
                    height: '98px',
                    borderRadius: '50%',
                    background: '#030616',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: '900', color: 'white' }}>{soldPercent}%</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Reservado</span>
                  </div>
                </div>
              </div>

              {/* Stats detail */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.4rem', borderRadius: '10px' }}>
                  <span style={{ display: 'block', color: 'var(--color-danger)', fontWeight: '700', fontSize: '1rem' }}>{soldCount}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.65rem' }}>Números Vendidos</span>
                </div>
                <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '0.4rem', borderRadius: '10px' }}>
                  <span style={{ display: 'block', color: 'var(--color-bright)', fontWeight: '700', fontSize: '1rem' }}>{freeCount}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.65rem' }}>Números Libres</span>
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '0.75rem',
                fontSize: '0.8rem',
                color: 'white',
                fontWeight: '600'
              }}>
                🎟️ Elegí tu número interactivo en la app:
                <br />
                <span style={{ color: 'var(--color-bright)', wordBreak: 'break-all', fontSize: '0.7rem', marginTop: '0.25rem', display: 'block' }}>
                  {window.location.origin}/#/raffle/{raffle.id}
                </span>
              </div>
            </div>
          )}

          {/* Bottom Info: Payment, Prizes, Beneficiary */}
          <div style={{ textAlign: 'center', background: 'rgba(10, 20, 60, 0.4)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '1rem' }}>
            {/* Payment Alias / Draw Type badge */}
            {raffle.draw_type === 'internal' ? (
              <div style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                fontWeight: '700',
                padding: '0.4rem 1.5rem',
                borderRadius: '99px',
                fontSize: '0.95rem',
                marginBottom: '0.75rem',
                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
              }}>
                SORTEO GRATUITO
              </div>
            ) : raffle.payment_alias ? (
              <div style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                color: 'white',
                fontWeight: '700',
                padding: '0.4rem 1.5rem',
                borderRadius: '99px',
                fontSize: '0.95rem',
                marginBottom: '0.75rem',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)'
              }}>
                PAGO ALIAS: {raffle.payment_alias}
              </div>
            ) : null}

            {/* Prizes list and Image */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '0.5rem auto', maxWidth: '380px', justifyContent: 'space-between', textAlign: 'left' }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.3rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  Premios en juego:
                </p>
                {raffle.prizes && raffle.prizes.map((prize, idx) => (
                  <div key={prize.id || idx} style={{ color: 'white', fontSize: '0.85rem', margin: '0.2rem 0', fontWeight: '500', lineHeight: '1.2' }}>
                    🏆 {prize.name}
                  </div>
                ))}
              </div>
              
              {/* If any prize has an image, render the first one as a flyer preview */}
              {raffle.prizes && raffle.prizes.find(p => p.image) && (
                <div style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--color-bright)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: '0 0 10px rgba(56, 189, 248, 0.4)'
                }}>
                  <img
                    src={raffle.prizes.find(p => p.image).image}
                    alt="Flyer Prize"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
            </div>

            {/* Beneficiary & Legal disclaimer stamp */}
            <div style={{ marginTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
              <p style={{ color: 'var(--color-bright)', fontSize: '0.85rem', fontWeight: '600' }}>
                En beneficio de: {raffle.beneficiary}
              </p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.65rem', marginTop: '0.4rem' }}>
                *Esta rifa es organizada y administrada exclusivamente por {raffle.creator_name} ({raffle.creator_email}).
              </p>
            </div>
          </div>

          {/* Footer watermark */}
          <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.2)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            rifasolidaria.app - Herramienta de uso benéfico
          </div>
          
        </div>
      </div>
    </div>
  );
};
