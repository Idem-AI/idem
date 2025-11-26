import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Configuration Vite simplifiée qui fonctionne
export default defineConfig({
  plugins: [
    react(), // Plugin React seulement
  ],

  base: './',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },

  server: {
    hmr: false, // Désactiver le HMR pour éviter les erreurs
    port: 5173,
  },

  css: {
    postcss: {
      plugins: [require('tailwindcss'), require('autoprefixer')],
    },
  },

  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.VITE_API_BASE_URL': JSON.stringify(
      process.env.VITE_API_BASE_URL || 'http://localhost:3001'
    ),
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
