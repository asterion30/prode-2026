import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';

export const LegalDisclaimer = ({ raffle }) => {
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reported, setReported] = useState(false);
  const { reportRaffle } = useDatabase();

  const handleReport = async (e) => {
    e.preventDefault();
    await reportRaffle(raffle.id);
    setReported(true);
    setTimeout(() => {
      setShowReportModal(false);
      setReported(false);
    }, 2000);
  };

  return (
    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      
      {/* Verification Shield */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.85rem 1rem',
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        borderRadius: '12px',
        fontSize: '0.8rem',
        textAlign: 'left'
      }}>
        <ShieldCheck className="text-success" style={{ flexShrink: 0, color: 'var(--color-success)' }} size={24} />
        <div>
          <span style={{ fontWeight: '700', color: 'white', display: 'block' }}>Rifa Benéfica Identificada</span>
          <span style={{ color: 'var(--color-text-muted)' }}>
            Organizado por <strong>{raffle.creator_name}</strong> ({raffle.creator_email}). Cuenta verificada con Google.
          </span>
        </div>
      </div>

      {/* Action Buttons: View Legal and Report */}
      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
        <button
          onClick={() => setShowLegalModal(true)}
          className="btn btn-secondary"
          style={{ flex: 1, padding: '0.5rem 1rem', fontSize: '0.8rem', gap: '0.35rem' }}
        >
          <Info size={14} />
          Marco Legal y Términos
        </button>
        <button
          onClick={() => setShowReportModal(true)}
          className="btn"
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            fontSize: '0.8rem',
            gap: '0.35rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--color-danger)'
          }}
        >
          <AlertTriangle size={14} />
          Denunciar Rifa
        </button>
      </div>

      {/* Legal Info Modal */}
      {showLegalModal && (
        <div className="modal-overlay" onClick={() => setShowLegalModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'left', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              <ShieldCheck style={{ color: 'var(--color-bright)' }} />
              Marco Legal de la Rifa
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
              
              <blockquote style={{
                borderLeft: '3px solid var(--color-bright)',
                paddingLeft: '0.75rem',
                background: 'rgba(56, 189, 248, 0.05)',
                padding: '0.75rem',
                borderRadius: '0 8px 8px 0',
                color: 'white',
                fontWeight: '500'
              }}>
                <strong>Importante:</strong> Esta es una herramienta digital de uso libre y gratuito provista para fines de organización interna. La aplicación no intermedia en transacciones monetarias.
              </blockquote>

              <p>
                <strong>1. Juego de Azar y Regulaciones Locales:</strong> En Argentina y otros países, la organización de sorteos o rifas con un costo de entrada entra en el marco legal de juegos de azar regulados provincial o municipalmente. Es responsabilidad del organizador de esta rifa ({raffle.creator_email}) gestionar los permisos necesarios ante el ente regulador de su localidad (ej. Lotería de su provincia).
              </p>

              <p>
                <strong>2. Recomendación de Premios:</strong> Para evitar infringir regulaciones sobre el juego ilegal, los premios de esta rifa no deben consistir en sumas de dinero en efectivo. Se promueve la entrega exclusiva de productos físicos, servicios o cupones de compra.
              </p>

              <p>
                <strong>3. Transparencia y Destino:</strong> Esta rifa se ha declarado en beneficio de: <strong>"{raffle.beneficiary}"</strong>. El organizador se compromete a destinar los fondos recaudados para dicho propósito y a publicar el resultado de forma clara.
              </p>

              <p>
                <strong>4. Exención de Responsabilidad:</strong> La plataforma no tiene relación, control ni injerencia sobre los fondos recaudados, la veracidad de la causa declarada ni sobre la entrega efectiva de los premios, lo cual es responsabilidad exclusiva de la persona organizadora identificada con su cuenta de Google.
              </p>

            </div>

            <button
              onClick={() => setShowLegalModal(false)}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1.5rem', padding: '0.6rem' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'left', maxWidth: '450px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)', marginBottom: '1rem' }}>
              <AlertOctagon />
              Reportar Rifa Sospechosa
            </h3>

            {reported ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-success)' }}>
                <ShieldCheck size={48} style={{ margin: '0 auto 1rem' }} />
                <h4>Denuncia Registrada</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Gracias por ayudarnos a mantener la comunidad segura. Evaluaremos este sorteo de inmediato.
                </p>
              </div>
            ) : (
              <form onSubmit={handleReport} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                  Si sospechas que esta rifa es falsa, maliciosa, infringe derechos o no cumple con los fines solidarios expresados, por favor denúnciala.
                </p>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Motivo del Reporte</label>
                  <select className="form-control" required style={{ background: '#0e1438' }}>
                    <option value="">Selecciona un motivo...</option>
                    <option value="fake">Sospecha de Estafa / Rifa Falsa</option>
                    <option value="commercial">Fines Comerciales / Lucro no Benéfico</option>
                    <option value="abuse">Contenido Inapropiado u Ofensivo</option>
                    <option value="money">Ofrece Premios en Dinero Prohibidos</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Detalles Adicionales</label>
                  <textarea
                    placeholder="Explica brevemente tu sospecha para ayudarnos en la revisión..."
                    className="form-control"
                    rows="3"
                    style={{ background: '#0e1438', resize: 'none' }}
                    required
                  ></textarea>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-danger" style={{ flex: 1 }}>
                    Enviar Reporte
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
