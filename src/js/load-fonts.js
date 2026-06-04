/**
 * load-fonts.js
 * Aplica recursos externos de forma no bloqueante y compatible con CSP.
 * Los preloads del <head> ya iniciaron las descargas en paralelo con el JS.
 */

// 1. Aplicar Phosphor Icons bold CSS
//    El <link rel="preload"> del head ya descargó el archivo. Solo cambiamos rel a stylesheet.
const preloadedBold = document.querySelector('link[rel="preload"][href*="phosphor"][href*="bold"]');
if (preloadedBold) {
    preloadedBold.rel = 'stylesheet';
} else {
    // Fallback si el preload no estaba disponible
    const fallback = document.createElement('link');
    fallback.rel = 'stylesheet';
    fallback.href = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/bold/style.css';
    document.head.appendChild(fallback);
}

// 2. Google Fonts — Inter (no crítico, se carga después del render inicial)
//    El <link rel="preload"> del head ya descargó el archivo. Solo cambiamos rel a stylesheet.
const preloadedInter = document.querySelector('link[rel="preload"][href*="fonts.googleapis.com"]');
if (preloadedInter) {
    preloadedInter.rel = 'stylesheet';
} else {
    // Fallback si el preload no estaba disponible
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.crossOrigin = 'anonymous';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(fontLink);
}
