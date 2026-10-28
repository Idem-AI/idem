/**
 * Configuration Vite du site — posée par IDEM, NE PAS MODIFIER.
 *
 * Un site multi-pages : chaque page est un document HTML à part (son titre, sa
 * description, ses balises de partage). Ces documents ne sont pas des fichiers
 * du projet : `scripts/pages/vite-plugin.mjs` les fabrique depuis `index.html`
 * et la liste des pages (`src/site/pages.json`), dans l'aperçu comme à la
 * construction. Un dossier qui contient un vrai `index.html` est aussi une page.
 */
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import idemDesignSystem from './scripts/design-system/vite-plugin.mjs';
import idemPages, { virtualPages } from './scripts/pages/vite-plugin.mjs';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

function pages() {
  const entries: Record<string, string> = { index: here('index.html') };
  const ignored = new Set(['node_modules', 'src', 'dist', 'public', 'scripts', '.git']);

  // Un niveau de plus pour les langues : `en/index.html`, `en/a-propos/index.html`.
  const walk = (dir: string, depth: number) => {
    for (const item of readdirSync(here(dir || '.'), { withFileTypes: true })) {
      if (!item.isDirectory() || ignored.has(item.name) || item.name.startsWith('.')) continue;
      const path = dir ? `${dir}/${item.name}` : item.name;
      if (existsSync(here(`${path}/index.html`))) entries[path.replace(/\//g, '-')] = here(`${path}/index.html`);
      if (depth < 1) walk(path, depth + 1);
    }
  };
  walk('', 0);

  // Les pages fabriquées : une entrée chacune, que le module des pages fournit.
  for (const page of virtualPages(here('.'))) entries[page.html.replace(/\/index\.html$/, '').replace(/\//g, '-')] = here(page.html);

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
  plugins: [idemPages(), idemDesignSystem(), react()],
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
