/**
 * load-fonts.js
 * Carga recursos externos de forma no bloqueante y compatible con CSP.
 * Se ejecuta como módulo ES — aceptado por la política script-src 'self'.
 */

// 1. Google Fonts — Inter
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.crossOrigin = 'anonymous';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
document.head.appendChild(fontLink);

// 2. Phosphor Icons — SOLO variante "bold" (usada en toda la app)
//    Evita cargar las otras 5 variantes (duotone, light, thin, fill, regular) = ~68 KiB ahorrados
const iconBoldLink = document.createElement('link');
iconBoldLink.rel = 'stylesheet';
iconBoldLink.href = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/bold/style.css';
document.head.appendChild(iconBoldLink);

// 3. Phosphor base — necesaria para ph-spinner (clase 'ph')
const iconBaseLink = document.createElement('link');
iconBaseLink.rel = 'stylesheet';
iconBaseLink.href = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css';
document.head.appendChild(iconBaseLink);
