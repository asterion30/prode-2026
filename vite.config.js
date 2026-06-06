import { defineConfig } from 'vite';
import sri from 'vite-plugin-sri-gen';

export default defineConfig({
  plugins: [
    sri({
      skipResources: [
        'google-fonts-preload',
        'https://fonts.googleapis.com/*',
        'https://fonts.gstatic.com/*'
      ]
    })
  ],
  root: './',
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    emptyOutDir: true,
    // Target modern browsers for better tree-shaking
    target: 'es2020',
    // Minificación agresiva
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,      // Eliminar console.log en producción
        drop_debugger: true,
        pure_funcs: ['console.info', 'console.debug'],
        passes: 2,               // Two passes for better dead code elimination
        toplevel: true,
      },
      format: {
        comments: false,         // Remueve comentarios sospechosos/sensibles (CWE-615)
      },
    },
    cssMinify: true,
    // Module preload disabled: handled natively by modern browsers
    modulePreload: { polyfill: false },
    // Separar vendors del código de la app (mejora caché) — función para Vite 8/rolldown
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('dompurify') || id.includes('html-to-image')) return 'vendor-utils';
        },
        // Nombres de archivos con hash para cache busting
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  }
});
