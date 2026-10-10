#!/usr/bin/env node
/**
 * Synchronise le référencement de chaque application avec la source unique
 * (`packages/shared-seo/src`).
 *
 *   node packages/shared-seo/scripts/sync.mjs          réécrit les fichiers
 *   node packages/shared-seo/scripts/sync.mjs --check  échoue si l'un d'eux a dérivé
 *
 * Pour chaque application servie sur son propre domaine (console, simulateur,
 * iCode, iDeploy, iVision), il écrit :
 *   - le bloc SEO de `index.html`, entre `<!-- idem-seo:start … -->` et `<!-- idem-seo:end -->` ;
 *   - `robots.txt` et `sitemap.xml` dans son dossier public ;
 * et, pour le landing, `robots.txt` et les plans du site par langue.
 *
 * Il vérifie aussi que chaque image de partage déclarée (`OG_KEYS`) a ses
 * textes dans chaque langue et son illustration dans `apps/api/public/og`.
 */
import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const root = join(pkg, '..', '..');
const check = process.argv.includes('--check');

// La source est en TypeScript : esbuild la compile en un module ESM jetable,
// ce qui garde le script indépendant de la version de Node.
const tmp = mkdtempSync(join(tmpdir(), 'idem-seo-'));
const outfile = join(tmp, 'seo.mjs');
await build({
  entryPoints: [join(pkg, 'src', 'index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
});
const seo = await import(pathToFileURL(outfile).href);
rmSync(tmp, { recursive: true, force: true });

/**
 * Les applications servies sur leur propre domaine. `locale` est la langue de
 * l'en-tête statique : ces applications choisissent leur langue au runtime,
 * sans préfixe d'URL, et leur public est d'abord francophone.
 * `publicPaths` : pages accessibles sans compte, en plus de la racine.
 */
const APPS = [
  {
    service: 'business',
    locale: 'fr',
    index: 'apps/main-dashboard/src/index.html',
    public: 'apps/main-dashboard/public',
    publicPaths: ['/login'],
  },
  {
    service: 'simulator',
    locale: 'fr',
    index: 'apps/simulation/src/index.html',
    public: 'apps/simulation/public',
    publicPaths: [],
  },
  {
    service: 'icode',
    locale: 'fr',
    index: 'apps/appgen/apps/we-dev-client/index.html',
    public: 'apps/appgen/apps/we-dev-client/public',
    publicPaths: [],
  },
  {
    service: 'ideploy',
    locale: 'fr',
    index: 'apps/ideploy-web/src/index.html',
    public: 'apps/ideploy-web/public',
    publicPaths: [],
  },
  {
    // La page publique d'iVision est sa racine ; l'atelier (/studio) demande un compte.
    service: 'ivision',
    locale: 'fr',
    index: 'apps/ivision/web/src/index.html',
    public: 'apps/ivision/web/public',
    publicPaths: [],
  },
];

const problems = [];
const written = [];

function sync(file, next) {
  const abs = join(root, file);
  const current = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  if (current === next) return;
  if (check) {
    problems.push(`${file} n'est pas à jour`);
    return;
  }
  writeFileSync(abs, next);
  written.push(file);
}

for (const app of APPS) {
  const abs = join(root, app.index);
  const html = readFileSync(abs, 'utf8');
  const start = html.indexOf('<!-- idem-seo:start');
  const end = html.indexOf(seo.HEAD_END);
  if (start < 0 || end < 0) {
    problems.push(`${app.index} : marqueurs idem-seo absents du <head>`);
    continue;
  }
  const lineStart = html.lastIndexOf('\n', start) + 1;
  const indent = html.slice(lineStart, start);
  const block = seo.renderServiceHead(app.service, app.locale, indent);
  const next = html.slice(0, lineStart) + block + html.slice(end + seo.HEAD_END.length);
  sync(app.index, next);
  sync(join(app.public, 'robots.txt'), seo.renderServiceRobots(app.service, app.publicPaths));
  sync(join(app.public, 'sitemap.xml'), seo.renderServiceSitemap(app.service));
}

// Le landing : robots.txt et plans du site, générés depuis LANDING_PAGES.
const landingPublic = 'apps/landing/public';
sync(join(landingPublic, 'robots.txt'), seo.renderLandingRobots());
sync(join(landingPublic, 'sitemap.xml'), seo.renderLandingSitemapIndex());
for (const locale of seo.SEO_LOCALES) {
  sync(join(landingPublic, `sitemap-${locale}.xml`), seo.renderLandingSitemap(locale));
}

// Chaque image de partage a ses textes dans chaque langue et son dessin.
const ogDir = join(root, 'apps', 'api', 'public', 'og');
for (const locale of seo.SEO_LOCALES) {
  const file = join(ogDir, 'i18n', `${locale}.json`);
  if (!existsSync(file)) {
    problems.push(`${relative(root, file)} manquant`);
    continue;
  }
  const texts = JSON.parse(readFileSync(file, 'utf8'));
  for (const key of seo.OG_KEYS) {
    const t = texts.pages?.[key];
    if (!t?.title || !t?.subtitle) problems.push(`og/i18n/${locale}.json : textes de « ${key} » manquants`);
  }
}
for (const key of seo.OG_KEYS) {
  if (!existsSync(join(ogDir, 'illustrations', `${key}.svg`))) {
    problems.push(`og/illustrations/${key}.svg manquant`);
  }
}

if (written.length) console.log(`✔ Réécrits :\n  ${written.join('\n  ')}`);
if (problems.length) {
  console.error(`✘ ${problems.length} problème(s) :\n  ${problems.join('\n  ')}`);
  if (check) console.error('\nLancer `npm run seo:sync` à la racine pour réécrire les fichiers.');
  process.exit(1);
}
console.log(check ? '✔ Référencement synchronisé.' : '✔ Terminé.');
