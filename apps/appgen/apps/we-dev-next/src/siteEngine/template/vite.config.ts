/**
 * Configuration Vite du site — posée par IDEM, NE PAS MODIFIER.
 *
 * Un site multi-pages : chaque page est un document HTML à part (son titre, sa
 * description, ses balises de partage), découvert à la volée. Ajouter une
 * page, c'est ajouter un dossier qui contient son `index.html`.
 */
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import idemDesignSystem from './scripts/design-system/vite-plugin.mjs';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

function pages() {
  const entries: Record<string, string> = { index: here('index.html') };
  const ignored = new Set(['node_modules', 'src', 'dist', 'public', 'scripts', '.git']);

  for (const item of readdirSync(here('.'), { withFileTypes: true })) {
    if (!item.isDirectory() || ignored.has(item.name) || item.name.startsWith('.')) continue;
    if (existsSync(here(`${item.name}/index.html`))) entries[item.name] = here(`${item.name}/index.html`);
  }

  return entries;
}

/**
 * Tout ce qu'une section peut importer, pré-regroupé dès le démarrage. Sans cette liste, Vite découvre une
 * dépendance à la première section qui l'importe, la regroupe, puis RECHARGE la page — dix à vingt secondes de plus
 * dans la WebContainer, plusieurs fois par génération.
 */
const PREBUNDLED = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
  'motion/react',
  'lucide-react',
  'clsx',
  'tailwind-merge',
  'class-variance-authority',
  '@radix-ui/react-accordion',
  '@radix-ui/react-avatar',
  '@radix-ui/react-checkbox',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-label',
  '@radix-ui/react-popover',
  '@radix-ui/react-radio-group',
  '@radix-ui/react-select',
  '@radix-ui/react-separator',
  '@radix-ui/react-slot',
  '@radix-ui/react-switch',
  '@radix-ui/react-tabs',
  '@radix-ui/react-tooltip',
  'date-fns',
  'embla-carousel-react',
  'react-hook-form',
  'zod',
];

export default defineConfig({
  plugins: [idemDesignSystem(), react()],
  resolve: {
    alias: { '@': here('src') },
  },
  build: { rollupOptions: { input: pages() } },
  optimizeDeps: { include: PREBUNDLED },
  server: {
    host: true,
    port: 5173,
    // Les pages et le design system transformés avant la première requête : l'aperçu s'affiche d'un coup.
    warmup: { clientFiles: ['./src/entries/*.tsx', './src/pages/*.tsx', './src/components/ui/*.tsx'] },
  },
});
