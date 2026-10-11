/**
 * `npm run build:mermaid --prefix apps/api` — le paquet Mermaid des rendus.
 *
 * Les navigateurs de rendu (PDF, pages de document) ne vont pas sur le réseau : les bibliothèques
 * y sont injectées depuis `public/scripts`, comme Tailwind et Chart.js. Mermaid 11 n'est livré
 * qu'en ESM avec chargement différé de ses familles de schémas ; il est donc empaqueté ici en un
 * seul fichier, une fois, et versionné avec l'application — un document validé ne doit pas se
 * redessiner autrement parce qu'une version a bougé.
 */
import { build } from 'esbuild';
import fs from 'fs';
import os from 'os';
import path from 'path';

const OUT = path.resolve(__dirname, '../../public/scripts/mermaid.js');

async function main(): Promise<void> {
  // Le chemin RÉEL du module : le fichier d'entrée vit hors du dépôt, où « mermaid » ne se
  // résoudrait pas. On lit son `module` (Mermaid 11 n'est livré qu'en ESM).
  const pkgPath = require.resolve('mermaid/package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { module?: string; main?: string; version?: string };
  const esm = path.join(path.dirname(pkgPath), pkg.module || pkg.main || 'dist/mermaid.core.mjs');
  if (!fs.existsSync(esm)) throw new Error(`Mermaid introuvable : ${esm}`);

  const entry = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'idem-mermaid-')), 'entry.mjs');
  // `window.mermaid` : la page l'appelle comme elle appelle `window.Chart`.
  fs.writeFileSync(entry, `import mermaid from ${JSON.stringify(esm)};\nwindow.mermaid = mermaid;\n`, 'utf8');

  const started = Date.now();
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome110',
    minify: true,
    legalComments: 'none',
    absWorkingDir: path.resolve(__dirname, '../../../..'),
    outfile: OUT,
    logLevel: 'error',
  });
  fs.rmSync(path.dirname(entry), { recursive: true, force: true });

  const bytes = fs.statSync(OUT).size;
  console.log(`✓ ${path.relative(process.cwd(), OUT)} — Mermaid ${pkg.version} en ${(bytes / 1024 / 1024).toFixed(2)} Mo (${Date.now() - started} ms)`);
  if (bytes < 500_000) {
    console.error('✗ paquet suspect (trop petit) : les familles de schémas ne sont probablement pas embarquées');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
