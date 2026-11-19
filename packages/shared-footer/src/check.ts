/**
 * Contrôle des textes juridiques et des pieds de page : `npm run check:legal`
 * (racine du dépôt). Sans réseau, sans base, sans modèle.
 *
 * Quatre listes doivent dire la même chose, et elles vivent dans quatre
 * endroits différents par nécessité :
 *
 *  1. le registre partagé (`src/legal.ts`), que lisent les cinq pieds de page ;
 *  2. les contenus (`apps/landing/src/app/shared/legal/docs/`) ;
 *  3. les routes de la landing (`apps/landing/src/app/app.routes.ts`) ;
 *  4. le référencement (`packages/shared-seo/src/landing.ts`).
 *
 * Plus le registre des sous-traitants, qui existe en deux versions : celle qui
 * engage le code (`apps/api/api/config/data-governance.ts`) et celle qui est
 * publiée (`apps/landing/src/app/shared/legal/processors.ts`).
 *
 * Un écart entre deux de ces listes ne casse pas un test unitaire : il produit
 * une page vide, un lien mort, ou — le pire — un sous-traitant qui reçoit des
 * données sans être déclaré nulle part de public. D'où ce contrôle.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEGAL_DOCS, footerLegalDocs, legalUrl, type LegalScope } from './legal';
import { DEFAULT_SERVICES, resolveFooter, type FooterApp } from './apps';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ok  ${label}`);
    return;
  }
  failures += 1;
  console.error(`  KO  ${label}${detail ? ` — ${detail}` : ''}`);
}

function read(relative: string): string {
  return readFileSync(resolve(repo, relative), 'utf8');
}

/** Les textes servis par un composant à eux, antérieurs au registre commun. */
const OWN_COMPONENT = new Set([
  'delete-account',
  'simulation-terms',
  'builders-terms',
  'builders-privacy',
  'beta-policy',
]);

// ── 1. Registre ↔ contenus ──────────────────────────────────────────────────

console.log('Registre et contenus');
const docsIndex = read('apps/landing/src/app/shared/legal/docs/index.ts');
for (const doc of LEGAL_DOCS) {
  if (OWN_COMPONENT.has(doc.id)) continue;
  check(
    `${doc.id} a un contenu`,
    docsIndex.includes(`'./${doc.id}'`),
    `ajoutez apps/landing/src/app/shared/legal/docs/${doc.id}.ts et importez-le dans docs/index.ts`
  );
}

// Un identifiant déclaré dans `id:` d'un contenu doit être celui du registre,
// sinon la page se charge et n'affiche rien.
const known = new Set(LEGAL_DOCS.map((doc) => doc.id));
for (const match of docsIndex.matchAll(/from '\.\/([a-z0-9-]+)'/g)) {
  check(`le contenu ${match[1]} est déclaré au registre`, known.has(match[1]));
}

// ── 2. Registre ↔ routes ────────────────────────────────────────────────────

console.log('Routes de la landing');
const routes = read('apps/landing/src/app/app.routes.ts');
for (const doc of LEGAL_DOCS) {
  const path = doc.path.replace(/^\//, '');
  check(`/${path} a une route`, routes.includes(`path: '${path}'`));
  if (!OWN_COMPONENT.has(doc.id)) {
    check(`/${path} désigne son contenu`, routes.includes(`legalDoc: '${doc.id}'`));
  }
}

// ── 3. Registre ↔ référencement ─────────────────────────────────────────────

console.log('Référencement');
const seo = read('packages/shared-seo/src/landing.ts');
for (const doc of LEGAL_DOCS) {
  if (doc.id === 'delete-account') continue; // page de compte, hors plan du site
  check(`${doc.path} est connu du référencement`, seo.includes(`path: '${doc.path}'`));
}

// ── 4. Sous-traitants : code ↔ page publiée ─────────────────────────────────

console.log('Sous-traitants');
const governance = read('apps/api/api/config/data-governance.ts');
const published = read('apps/landing/src/app/shared/legal/processors.ts');
const block = governance.slice(governance.indexOf('export const PROCESSORS'));
const declared = [...block.matchAll(/^\s{2}([a-z_]+):\s*\{/gm)].map((m) => m[1]);
check('le registre du code a été lu', declared.length > 0, 'PROCESSORS introuvable');
for (const id of declared) {
  check(`${id} est publié`, published.includes(`id: '${id}'`), 'ajoutez-le à PUBLIC_PROCESSORS');
}
for (const match of published.matchAll(/id: '([a-z_]+)'/g)) {
  check(`${match[1]} existe dans le code`, declared.includes(match[1]));
}

// ── 5. Les pieds de page ────────────────────────────────────────────────────

console.log('Pieds de page');
const apps: FooterApp[] = ['idem', 'icode', 'ideploy', 'ivision', 'idomain', 'isimulator'];
for (const app of apps) {
  const footer = resolveFooter(app, { locale: 'fr' });
  check(`${app} : trois colonnes`, footer.columns.length === 3);
  check(
    `${app} : aucune colonne vide`,
    footer.columns.every((column) => column.links.length > 0 && column.title !== '')
  );
  check(
    `${app} : aucun lien sans adresse`,
    footer.columns.every((column) => column.links.every((link) => link.href !== ''))
  );
  check(
    `${app} : la confidentialité et les conditions y sont`,
    footer.legal.some((link) => link.href.includes('/privacy-policy')) &&
      footer.legal.some((link) => link.href.includes('/terms-of-service'))
  );
  const en = resolveFooter(app, { locale: 'en' });
  check(`${app} : traduit en anglais`, en.tagline !== footer.tagline && en.claim !== footer.claim);
}

// Un service doit porter ses propres textes, en plus des textes globaux.
const scopes: [FooterApp, LegalScope][] = [
  ['icode', 'icode'],
  ['ideploy', 'ideploy'],
  ['ivision', 'ivision'],
  ['idomain', 'idomain'],
  ['isimulator', 'isimulator'],
];
for (const [app, scope] of scopes) {
  const legal = resolveFooter(app, { locale: 'fr' }).legal;
  const own = LEGAL_DOCS.filter((doc) => doc.scope === scope && !OWN_COMPONENT.has(doc.id));
  for (const doc of own) {
    check(
      `${app} renvoie à ${doc.id}`,
      legal.some((link) => link.href.endsWith(doc.path))
    );
  }
}

console.log('Adresses');
check(
  'la landing est absolue hors de la landing',
  legalUrl(LEGAL_DOCS[0], { landingUrl: 'https://idem.africa', locale: 'fr' }) ===
    'https://idem.africa/fr/privacy-policy'
);
check(
  'et relative sur la landing',
  legalUrl(LEGAL_DOCS[0], { locale: 'fr' }) === '/privacy-policy'
);
check(
  'une adresse vide ne masque pas la production',
  resolveFooter('icode', { services: { ideploy: '' } }).columns.some((column) =>
    column.links.some((link) => link.href.startsWith(DEFAULT_SERVICES.ideploy))
  )
);
check(
  'les textes globaux passent avant les compléments',
  footerLegalDocs('icode')[0].scope === 'global'
);

if (failures > 0) {
  console.error(`\n${failures} contrôle(s) en échec.`);
  process.exit(1);
}
console.log('\nTous les contrôles passent.');
