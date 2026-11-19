/**
 * Vérifie la construction des sites vitrines (template ≥ 1.4), sans modèle ni réseau :
 *
 *   - Motion allégé : la réécriture `motion` → `m` des imports, et `domMax` → `domAnimation` dans les entrées ;
 *   - polices servies par le site : feuille téléchargée, alphabets filtrés, préchargement, repli sur le lien
 *     d'origine quand le téléchargement échoue ;
 *   - CSS court écrit dans la page, `<meta charset>` gardé en tête ;
 *   - contrôle du HTML final : page non pré-rendue, titre, description, h1, alt ;
 *   - hydratation différée : `defer` posé par l'assemblage, lu par la carte du site, gardé par l'insertion et la
 *     remise en place d'une section.
 *
 *   npm run check:site-build
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { renderEntry, renderPage, restoreInPage } from '../src/siteEngine/project.js';
import { insertSection } from '../src/siteEngine/edit.js';
import type { ManifestPage } from '../src/siteEngine/manifest.js';

const TEMPLATE = fileURLToPath(new URL('../src/siteEngine/template/', import.meta.url));
const motion = await import(pathToFileURL(join(TEMPLATE, 'scripts/motion/vite-plugin.mjs')).href);
const post = await import(pathToFileURL(join(TEMPLATE, 'scripts/postbuild.mjs')).href);

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  ÉCHEC ${label}${detail === undefined ? '' : `\n       ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
  }
};

/* -------------------------------------------------------------------------- */
console.log('Motion allégé');
const rename = motion.renameMotionImports as (code: string, renames: Record<string, string>) => string;
check('motion seul', rename(`import { motion } from 'motion/react';`, { motion: 'm' }) === `import { m as motion } from 'motion/react';`);
check(
  'motion parmi d’autres, sur plusieurs lignes',
  rename(`import {\n  motion,\n  useInView,\n  AnimatePresence\n} from "motion/react";`, { motion: 'm' }) ===
    `import {\n  m as motion,\n  useInView,\n  AnimatePresence\n} from "motion/react";`
);
check('alias gardé', rename(`import { motion as M } from 'motion/react';`, { motion: 'm' }) === `import { m as M } from 'motion/react';`);
check('nom voisin intact (motionValue)', rename(`import { motionValue } from 'motion/react';`, { motion: 'm' }) === `import { motionValue } from 'motion/react';`);
check('autre paquet intact', rename(`import { motion } from 'framer-motion';`, { motion: 'm' }) === `import { motion } from 'framer-motion';`);
const entry = renderEntry('home');
check('l’entrée enveloppe la page dans LazyMotion', /<LazyMotion features=\{domMax\}>/.test(entry));
check(
  'entrée : domMax → domAnimation',
  /import \{ LazyMotion, MotionConfig, domAnimation as domMax \} from 'motion\/react';/.test(rename(entry, { domMax: 'domAnimation' }))
);

const site = mkdtempSync(join(tmpdir(), 'idem-site-build-'));
const write = (path: string, content: string) => {
  mkdirSync(join(site, path, '..'), { recursive: true });
  writeFileSync(join(site, path), content);
};
write('src/entries/home.tsx', entry);
write('src/sections/home/Hero.tsx', `import { motion } from 'motion/react';\nexport default () => <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Bonjour</motion.h1>;`);
check('entrées avec LazyMotion reconnues', motion.entriesProvideLazyMotion(site) === true);
check('fondus seuls → domAnimation suffit', motion.needsMaxFeatures(site) === false);
write('src/sections/home/Board.tsx', `import { motion } from 'motion/react';\nexport default () => <motion.div drag="x" layout />;`);
check('glisser → domMax gardé', motion.needsMaxFeatures(site) === true);
write('src/entries/about.tsx', entry.replace(/<\/?LazyMotion[^>]*>/g, ''));
check('une entrée d’avant (sans LazyMotion) → aucune réécriture', motion.entriesProvideLazyMotion(site) === false);
rmSync(site, { recursive: true, force: true });

/* -------------------------------------------------------------------------- */
console.log('Polices servies par le site');
const FONT_CSS = `/* cyrillic */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v1/cyr.woff2) format('woff2');
  unicode-range: U+0400-045F;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/inter/v1/latin700.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 500;
  src: url(https://fonts.gstatic.com/s/inter/v1/latin500.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}`;
const FONT_HREF = 'https://fonts.googleapis.com/css?family=Inter:700,500&display=swap';
const requested: string[] = [];
const fakeFetch = (fail = false) =>
  (async (input: string) => {
    requested.push(String(input));
    if (fail) throw new Error('réseau coupé');
    if (String(input).startsWith('https://fonts.googleapis.com/')) return new Response(FONT_CSS, { status: 200 });
    // Un contenu propre à chaque fichier : le nom local est l'empreinte du contenu.
    if (String(input).endsWith('.woff2')) return new Response(new TextEncoder().encode(`wOF2${input}`), { status: 200 });
    return new Response('', { status: 404 });
  }) as unknown as typeof fetch;

/** Un site construit, réduit à l'essentiel : deux pages, une feuille de style, des polices Google. */
function builtSite(options: { prerendered: boolean; h1?: boolean; css?: string }) {
  const root = mkdtempSync(join(tmpdir(), 'idem-dist-'));
  const page = (title: string, body: string) => `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="Coaching de transformation personnelle à Douala, séances individuelles et ateliers." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${FONT_HREF}" />
    <script type="module" crossorigin src="/assets/home-Abc12345.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-Xyz98765.css">
  </head>
  <body>
    <div id="root">${body}</div>
  </body>
</html>
`;
  const text = 'Lumière accompagne les femmes et les hommes de Douala qui veulent changer de vie, avec des séances individuelles, des ateliers en groupe et un suivi sur trois mois pour tenir dans la durée.';
  const body = options.prerendered ? `<header><a href="/">Lumière</a></header><main>${options.h1 === false ? '<h2>' : '<h1>'}Changer de vie, pas à pas${options.h1 === false ? '</h2>' : '</h1>'}<p>${text}</p><img src="/a.jpg"></main>` : '';
  mkdirSync(join(root, 'dist/assets'), { recursive: true });
  mkdirSync(join(root, 'dist/a-propos'), { recursive: true });
  writeFileSync(join(root, 'dist/index.html'), page('Lumière', body));
  writeFileSync(join(root, 'dist/a-propos/index.html'), page('À propos | Lumière', body));
  writeFileSync(join(root, 'dist/assets/index-Xyz98765.css'), options.css ?? '.a{color:red}');
  writeFileSync(join(root, 'dist/sitemap.xml'), '<urlset><url><loc>/</loc></url><url><loc>/a-propos/</loc></url></urlset>');
  mkdirSync(join(root, 'src/site'), { recursive: true });
  writeFileSync(join(root, 'src/site/pages.json'), JSON.stringify({ languages: ['fr'], pages: [] }));
  return root;
}

/** Ce que rend `postbuild()` (le bilan écrit dans `.idem/build-report.json`). */
type BuildReport = { seo: { errors: string[]; warnings: string[] } };

const quiet = async (run: () => Promise<unknown>): Promise<BuildReport> => {
  const log = console.log;
  console.log = () => {};
  try {
    return (await run()) as BuildReport;
  } finally {
    console.log = log;
  }
};

{
  const root = builtSite({ prerendered: true });
  const report = await quiet(() => post.postbuild({ root, fetchImpl: fakeFetch(), strict: false }));
  const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
  const fonts = readdirSync(join(root, 'dist/assets/fonts'));
  check('feuille Google retirée de la page', !html.includes('fonts.googleapis.com/css'), html.slice(0, 600));
  check('connexions préparées vers Google retirées', !/preconnect[^>]*fonts\.g/.test(html));
  check('@font-face écrits dans la page, adresses locales', /<style data-idem-fonts>[\s\S]*url\(\/assets\/fonts\/font-[0-9a-f]{12}\.woff2\)/.test(html));
  check('alphabet cyrillique écarté (site en français)', !/cyrillic/.test(html) && !requested.some((url) => url.endsWith('cyr.woff2')));
  check('font-display: swap ajouté là où il manquait', (html.match(/font-display: swap/g) ?? []).length === 2, html.match(/<style data-idem-fonts>[\s\S]*?<\/style>/)?.[0]);
  check('deux fichiers de police téléchargés une seule fois pour deux pages', fonts.length === 2, fonts);
  check('préchargement de la première graisse demandée (700, latin) seulement', (html.match(/rel="preload"[^>]*as="font"/g) ?? []).length === 1);
  check('<meta charset> reste avant les styles ajoutés', html.indexOf('<meta charset') < html.indexOf('<style'));
  check('feuille de style courte écrite dans la page', /<style data-idem-inline="\/assets\/index-Xyz98765\.css">\.a\{color:red\}<\/style>/.test(html));
  check('aucune erreur de référencement sur un site sain', report.seo.errors.length === 0, report.seo.errors);
  check('image sans alt signalée', report.seo.warnings.some((line: string) => /sans texte alternatif/.test(line)), report.seo.warnings);
  check('bilan écrit hors de dist/ (jamais publié)', existsSync(join(root, '.idem/build-report.json')) && !existsSync(join(root, 'dist/.idem')));
  rmSync(root, { recursive: true, force: true });
}

{
  const faces = post.preloadFacesOf({ tokens: { typography: { headingFont: 'Inter', headingWeight: 650, bodyFont: 'Inter', bodyWeight: 400 } } });
  check('préchargement : titre à sa graisse (650 → 700) et texte (400)', JSON.stringify(faces) === JSON.stringify([{ family: 'Inter', weight: '700' }, { family: 'Inter', weight: '400' }]), faces);
  const same = post.preloadFacesOf({ tokens: { typography: { headingFont: 'Inter', headingWeight: 400, bodyFont: 'Inter', bodyWeight: 400 } } });
  check('préchargement : une seule face quand titre et texte sont identiques', same.length === 1, same);
}

{
  const root = builtSite({ prerendered: true, css: `.big{content:"${'x'.repeat(post.INLINE_CSS_MAX_BYTES)}"}` });
  requested.length = 0;
  await quiet(() => post.postbuild({ root, fetchImpl: fakeFetch(true), strict: false }));
  const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
  check('réseau coupé : le lien Google d’origine est gardé', html.includes(`href="${FONT_HREF}"`));
  check('réseau coupé : les connexions préparées restent', /preconnect[^>]*fonts\.googleapis/.test(html));
  check('feuille de style longue gardée en fichier (cache entre pages)', html.includes('href="/assets/index-Xyz98765.css"'));
  rmSync(root, { recursive: true, force: true });
}

/* -------------------------------------------------------------------------- */
console.log('Contrôle du HTML final');
{
  const root = builtSite({ prerendered: false });
  writeFileSync(join(root, '.idem-prerender-placeholder'), '');
  mkdirSync(join(root, '.idem'), { recursive: true });
  writeFileSync(join(root, '.idem/prerender.json'), JSON.stringify({ rendered: [], failed: [{ path: '/', error: 'window is not defined' }] }));
  const report = await quiet(() => post.postbuild({ root, fetchImpl: fakeFetch(), strict: false }));
  check('page sans texte pré-rendu = erreur', report.seo.errors.some((line: string) => /non pré-rendue/.test(line)), report.seo.errors);
  check('échec du pré-rendu remonté avec sa cause', report.seo.errors.some((line: string) => /window is not defined/.test(line)), report.seo.errors);
  check('bilan du pré-rendu consommé', !existsSync(join(root, '.idem/prerender.json')));
  rmSync(root, { recursive: true, force: true });
}
{
  const root = builtSite({ prerendered: true, h1: false });
  const exit = process.exitCode;
  const report = await quiet(() => post.postbuild({ root, fetchImpl: fakeFetch(), strict: true }));
  check('pas de h1 = erreur', report.seo.errors.some((line: string) => /<h1>/.test(line)), report.seo.errors);
  check('IDEM_BUILD_STRICT : la construction échoue', process.exitCode === 1);
  process.exitCode = exit;
  rmSync(root, { recursive: true, force: true });
}
{
  const audit = post.auditPages(
    [
      { path: '/', html: '<html lang="fr"><head><title>Accueil</title></head><body><div id="root"><h1>a</h1>' + ' mot'.repeat(30) + '</div></body></html>' },
      { path: '/b/', html: '<html lang="fr"><head><title>Accueil</title><meta name="description" content="x"></head><body><div id="root"><h1>a</h1><h1>b</h1>' + ' mot'.repeat(30) + '</div></body></html>' },
    ],
    { url: 'https://exemple.cm', sitemap: '<loc>/</loc>' }
  );
  check('description absente = erreur', audit.errors.some((line: string) => /^\/ : pas de description/.test(line)), audit.errors);
  check('titre en double signalé', audit.warnings.some((line: string) => /même titre/.test(line)), audit.warnings);
  check('deux h1 signalés', audit.warnings.some((line: string) => /2 titres principaux/.test(line)), audit.warnings);
  check('canonique absente signalée (adresse connue)', audit.warnings.some((line: string) => /canonique/.test(line)), audit.warnings);
  check('plan du site incomplet signalé', audit.warnings.some((line: string) => /plan du site incomplet/.test(line)), audit.warnings);
}

/* -------------------------------------------------------------------------- */
console.log('Hydratation différée');
const manifestPage = { key: 'home', path: '/', label: 'Accueil', purpose: '', seoTitle: '', seoDescription: '', sections: [] } as unknown as ManifestPage;
const assembled = renderPage(manifestPage, [
  { name: 'Hero', ok: true },
  { name: 'Services', ok: true },
  { name: 'Faq', ok: false },
]);
check('première section hydratée tout de suite', /<SectionBoundary name="Hero">/.test(assembled));
check('sections suivantes différées', /<SectionBoundary name="Services" defer>/.test(assembled));
check('en-tête jamais différé', /<SectionBoundary name="SiteHeader">/.test(assembled));
check('pied de page différé', /<SectionBoundary name="SiteFooter" defer>/.test(assembled));
const restored = restoreInPage(assembled, ['Faq']);
check('section remise en place : garde defer', /<SectionBoundary name="Faq" defer>\n\s*<Faq \/>/.test(restored), restored);
const inserted = insertSection(restored, 'Pricing', '@/sections/home/Pricing.tsx', 'Services');
check('section insérée après une section différée : placée et différée', /<SectionBoundary name="Services" defer>\n\s*<Services \/>\n\s*<\/SectionBoundary>\n\s*<SectionBoundary name="Pricing" defer>/.test(inserted), inserted);
const legacy = insertSection(assembled.replace(/ defer>/g, '>'), 'Pricing', '@/sections/home/Pricing.tsx', 'Services');
check('page d’avant (sans defer) : section insérée sans defer', /<SectionBoundary name="Pricing">/.test(legacy));

const boundary = readFileSync(join(TEMPLATE, 'src/components/site/section-boundary.tsx'), 'utf8');
check('frontière : HTML pré-rendu repris tel quel', /dangerouslySetInnerHTML=\{\{ __html: html \}\}/.test(boundary) && /suppressHydrationWarning/.test(boundary));
check('frontière : section visible au chargement hydratée tout de suite', /top < window\.innerHeight \+ 400/.test(boundary));

console.log(failures ? `\n${failures} échec(s).` : '\nTout est vert.');
process.exit(failures ? 1 : 0);
