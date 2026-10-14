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

export default defineConfig({
  plugins: [idemDesignSystem(), react()],
  resolve: {
    alias: { '@': here('src') },
  },
  build: { rollupOptions: { input: pages() } },
  server: { host: true, port: 5173 },
});
