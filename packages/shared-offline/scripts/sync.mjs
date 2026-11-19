/**
 * Recopie le service worker partagé dans les assets d'une application.
 *
 * Pourquoi une copie et non un lien symbolique : Angular publie un lien tel
 * quel dans `dist/`, et le `COPY --from=builder` de Docker emporterait alors
 * un lien mort — `/sw.js` en 404 dans l'image de production, donc aucune mise
 * en cache et aucun garde-fou contre les versions périmées.
 *
 * Appelé par le `prebuild` de chaque application. Le fichier produit est
 * ignoré par git : la source reste `packages/shared-offline/src/sw.js`.
 *
 * Usage : node <ce fichier> <dossier des assets>    (par défaut `public`)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '..', 'src', 'sw.js');
const targetDir = resolve(process.cwd(), process.argv[2] ?? 'public');
const target = join(targetDir, 'sw.js');

if (!existsSync(source)) {
  console.error(`[shared-offline] introuvable : ${source}`);
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

const banner =
  '/* FICHIER GÉNÉRÉ — ne pas modifier ici.\n' +
  '   Source : packages/shared-offline/src/sw.js (recopié par le prebuild). */\n';

writeFileSync(target, banner + readFileSync(source, 'utf8'));
console.log(`[shared-offline] sw.js -> ${target}`);
