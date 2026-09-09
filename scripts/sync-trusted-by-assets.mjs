#!/usr/bin/env node
/**
 * Propage le bandeau « Ils nous font confiance » vers les applications.
 *
 * Chaque application sert ses propres fichiers statiques : un composant
 * partagé ne suffit pas, il faut aussi que les logos existent dans le dossier
 * public de chacune. Ce script y dépose les logos de
 * `packages/shared-trusted-by/assets`. Le reste du bandeau — la liste des
 * partenaires et la feuille de style — est importé depuis le paquet et
 * empaqueté par le bundler de chaque application : rien à copier.
 *
 * Usage :
 *   node scripts/sync-trusted-by-assets.mjs [--check]
 *
 * `--check` ne copie rien et sort en échec si une cible est absente ou
 * périmée — de quoi brancher la vérification sur la CI.
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = join(repoRoot, 'packages', 'shared-trusted-by');
const assetsDir = join(packageDir, 'assets');
const partnersFile = join(packageDir, 'partners.json');

/**
 * Dossier public de chaque application qui affiche le bandeau, relatif à la
 * racine du dépôt.
 *
 * Absents volontairement : `chart` et `main-dashboard`, qui n'ont pas de
 * landing page, et `ideploy` — la version Laravel historique, remplacée par
 * `ideploy-web`, qu'on laisse telle quelle.
 */
const TARGETS = [
  'apps/landing/public',
  'apps/ideploy-web/public',
  'apps/simulation/public',
  'apps/appgen/apps/we-dev-client/public',
];

/** Sous-chemin commun, aligné sur `assetsBasePath` de `partners.json`. */
const { assetsBasePath } = JSON.parse(readFileSync(partnersFile, 'utf8'));
const subPath = assetsBasePath.replace(/^\/+/, '');

const checkOnly = process.argv.includes('--check');
const digest = (file) => createHash('sha1').update(readFileSync(file)).digest('hex');

const sources = readdirSync(assetsDir).map((name) => ({ name, from: join(assetsDir, name) }));

let stale = 0;
let copied = 0;

for (const target of TARGETS) {
  const destDir = join(repoRoot, target, subPath);
  if (!existsSync(join(repoRoot, target))) {
    console.error(`✗ ${target} — dossier public introuvable, application ignorée`);
    stale += 1;
    continue;
  }

  const outdated = sources.filter(
    ({ name, from }) =>
      !existsSync(join(destDir, name)) || digest(from) !== digest(join(destDir, name))
  );

  if (outdated.length === 0) {
    console.log(`✓ ${relative(repoRoot, destDir)} — à jour`);
    continue;
  }

  if (checkOnly) {
    console.error(
      `✗ ${relative(repoRoot, destDir)} — ${outdated.length} fichier(s) manquant(s) ou périmé(s)`
    );
    stale += outdated.length;
    continue;
  }

  mkdirSync(destDir, { recursive: true });
  for (const { name, from } of outdated) {
    cpSync(from, join(destDir, name));
    copied += 1;
  }
  console.log(`→ ${relative(repoRoot, destDir)} — ${outdated.length} fichier(s) copié(s)`);
}

if (checkOnly && stale > 0) {
  console.error('\nLancez `npm run sync:trusted-by` puis versionnez le résultat.');
  process.exit(1);
}

if (!checkOnly) {
  console.log(`\n${copied} fichier(s) copié(s) vers ${TARGETS.length} application(s).`);
}
