/**
 * load-fonts.js
 * Carga Google Fonts de forma no bloqueante y compatible con la CSP.
 * Se ejecuta como módulo ES para ser aceptado por la política script-src 'self'.
 */
const link = document.createElement('link');
link.rel = 'stylesheet';
link.crossOrigin = 'anonymous';
link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
document.head.appendChild(link);
