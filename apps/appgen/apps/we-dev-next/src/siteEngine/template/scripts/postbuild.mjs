/**
 * Après la construction — posé par IDEM, NE PAS MODIFIER.
 *
 * Lancé après `vite build` et le pré-rendu, sur les pages de `dist/` :
 *
 *   1. polices    les feuilles de polices externes (Google Fonts) sont téléchargées et servies par le site : plus de
 *                 feuille bloquante sur un autre domaine (deux connexions de plus avant le premier texte), les fichiers
 *                 de la langue du site préchargés. Si le téléchargement échoue, la page garde son lien d'origine.
 *   2. CSS        une feuille de style courte est écrite dans la page : une requête bloquante de moins.
 *   3. contrôle   le HTML final est relu comme le lit un moteur de recherche (titre, description, h1, texte pré-rendu,
 *                 canonique, textes alternatifs, plan du site).
 *
 * Le bilan (pré-rendu, polices, contrôle) est écrit dans `.idem/build-report.json` (jamais publié) et résumé dans le
 * terminal. `IDEM_BUILD_STRICT=1` fait échouer la construction sur une erreur.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIST = 'dist';
export const REPORT = '.idem/build-report.json';
export const PRERENDER_REPORT = '.idem/prerender.json';

/** Au-delà, la feuille de style reste un fichier (mis en cache d'une page à l'autre). */
export const INLINE_CSS_MAX_BYTES = 40 * 1024;

/** Un navigateur récent : Google Fonts répond alors en woff2, découpé par alphabet (`unicode-range`). */
const MODERN_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 15_000;

/* -------------------------------------------------------------------------- */
/*  Utilitaires                                                               */
/* -------------------------------------------------------------------------- */

const hash = (text, length = 10) => createHash('sha1').update(text).digest('hex').slice(0, length);

export function htmlFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) out.push(...htmlFiles(path));
    else if (item.name.endsWith('.html')) out.push(path);
  }
  return out;
}

const decode = (text) =>
  String(text ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const attr = (tag, name) => {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? decode(match[2] ?? match[3] ?? match[4] ?? '') : null;
};

/* -------------------------------------------------------------------------- */
/*  1. Polices                                                                 */
/* -------------------------------------------------------------------------- */

/** Les alphabets à garder pour les langues du site (les commentaires `/* latin *\/` de Google Fonts). */
const SUBSETS_BY_LANG = {
  ru: ['cyrillic', 'cyrillic-ext'],
  uk: ['cyrillic', 'cyrillic-ext'],
  bg: ['cyrillic', 'cyrillic-ext'],
  el: ['greek', 'greek-ext'],
  vi: ['vietnamese'],
  ar: ['arabic'],
  fa: ['arabic'],
  ur: ['arabic'],
  he: ['hebrew'],
  hi: ['devanagari'],
  zh: ['chinese-simplified'],
  ja: ['japanese'],
  ko: ['korean'],
  th: ['thai'],
  am: ['ethiopic'],
};

/** Les blocs `@font-face` d'une feuille, avec l'alphabet annoncé par le commentaire qui les précède. */
export function fontFaces(css) {
  const faces = [];
  const re = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g;
  let match;
  while ((match = re.exec(css))) faces.push({ subset: match[1] ?? null, body: match[2] });
  return faces;
}

/** Vrai si la feuille ne contient que des `@font-face` (rien d'autre à perdre en la réécrivant). */
export function onlyFontFaces(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').trim() === '' && /@font-face/.test(css);
}

/** Les familles et graisses demandées par une adresse Google Fonts (`family=Inter:400,700`), dans l'ordre. */
export function requestedFaces(href) {
  try {
    const url = new URL(href);
    return url.searchParams.getAll('family').flatMap((value) => {
      const [name, weights = '400'] = value.split(':');
      const first = weights.replace(/^[^@]*@/, '').split(/[,;]/)[0].replace(/^\d,/, '') || '400';
      return [{ family: name.replace(/\+/g, ' '), weight: first.replace(/\D/g, '') || '400' }];
    });
  } catch {
    return [];
  }
}

/**
 * Télécharge une feuille de polices et ses fichiers dans `dist/assets/fonts/`. Rend la feuille réécrite (adresses
 * locales, `font-display: swap`, alphabets du site seulement) et les fichiers à précharger, ou `null` si la feuille
 * n'est pas une feuille de polices ou si un téléchargement échoue (la page garde alors le lien d'origine).
 */
export async function selfHostStylesheet(href, { dist, languages, preloadFaces = null, fetchImpl = fetch }) {
  const response = await fetchImpl(href, { headers: { 'user-agent': MODERN_UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${href} : HTTP ${response.status}`);
  const css = await response.text();
  if (!onlyFontFaces(css)) return null;

  const wanted = new Set(['latin', 'latin-ext', ...languages.flatMap((lang) => SUBSETS_BY_LANG[lang.split('-')[0]] ?? [])]);
  const faces = fontFaces(css).filter((face) => !face.subset || wanted.has(face.subset));
  if (!faces.length) return null;

  const outDir = join(dist, 'assets/fonts');
  mkdirSync(outDir, { recursive: true });
  const downloads = new Map();
  const local = async (url) => {
    const absolute = new URL(url, href).href;
    if (!downloads.has(absolute)) {
      downloads.set(
        absolute,
        (async () => {
          const file = await fetchImpl(absolute, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
          if (!file.ok) throw new Error(`${absolute} : HTTP ${file.status}`);
          const bytes = Buffer.from(await file.arrayBuffer());
          const extension = (absolute.match(/\.(woff2?|ttf|otf)(?:[?#]|$)/i)?.[1] ?? 'woff2').toLowerCase();
          // Le nom porte l'empreinte du contenu : le serveur peut le garder en cache pour toujours.
          const name = `font-${hash(bytes.toString('base64'), 12)}.${extension}`;
          writeFileSync(join(outDir, name), bytes);
          return `/assets/fonts/${name}`;
        })()
      );
    }
    return downloads.get(absolute);
  };

  // Les faces à précharger : celles du titre et du texte (design system), sinon la première graisse de chaque famille.
  const requested = preloadFaces?.length ? preloadFaces : requestedFaces(href);
  const preload = [];
  const rules = [];
  for (const face of faces) {
    let body = face.body;
    for (const match of [...body.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)]) {
      body = body.replace(match[0], `url(${await local(match[2])})`);
    }
    if (!/font-display\s*:/.test(body)) body = `${body.trimEnd()}\n  font-display: swap;\n`;
    rules.push(`${face.subset ? `/* ${face.subset} */\n` : ''}@font-face {${body}}`);

    // Préchargé : l'alphabet latin de la première graisse demandée de chaque famille (le titre, le texte).
    const family = body.match(/font-family\s*:\s*['"]?([^;'"]+)/)?.[1]?.trim();
    const weight = body.match(/font-weight\s*:\s*(\d+)/)?.[1];
    const style = body.match(/font-style\s*:\s*(\w+)/)?.[1] ?? 'normal';
    const file = body.match(/url\(([^)]+\.woff2)\)/)?.[1];
    if (file && style === 'normal' && (face.subset === 'latin' || !face.subset) && requested.some((r) => r.family === family && r.weight === weight)) {
      preload.push(file);
    }
  }
  return { css: rules.join('\n'), preload: [...new Set(preload)] };
}

/** Les liens de feuilles de style externes d'une page (adresse absolue, autre domaine). */
export function externalStylesheets(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => /\brel\s*=\s*["']?stylesheet/i.test(tag) && /^https?:\/\//i.test(attr(tag, 'href') ?? ''))
    .map((tag) => ({ tag, href: attr(tag, 'href') }));
}

/**
 * Les faces qui s'affichent en premier : la police des titres à sa graisse, celle du texte à la sienne (lues dans
 * `design-system.json`, graisses arrondies à la centaine comme les demande le compilateur).
 */
export function preloadFacesOf(designSystem) {
  const typography = designSystem?.tokens?.typography ?? {};
  const round = (value, fallback) => String(Math.round((Number(value) || fallback) / 100) * 100);
  const faces = [
    { family: typography.headingFont || 'Inter', weight: round(typography.headingWeight, 650) },
    { family: typography.bodyFont || 'Inter', weight: round(typography.bodyWeight, 400) },
  ];
  return faces.filter((face, index) => faces.findIndex((other) => other.family === face.family && other.weight === face.weight) === index);
}

async function selfHostFonts(pages, { dist, languages, preloadFaces, fetchImpl }) {
  const report = { hosted: [], kept: [], files: 0 };
  const cache = new Map();
  const resolve = (href) => {
    if (!cache.has(href)) cache.set(href, selfHostStylesheet(href, { dist, languages, preloadFaces, fetchImpl }).catch((error) => ({ error: error.message })));
    return cache.get(href);
  };

  for (const file of pages) {
    let html = readFileSync(file, 'utf8');
    const links = externalStylesheets(html);
    if (!links.length) continue;
    const styles = [];
    const preloads = [];
    let changed = false;
    for (const { tag, href } of links) {
      const result = await resolve(href);
      if (!result || result.error) {
        if (!report.kept.some((kept) => kept.href === href)) report.kept.push({ href, reason: result?.error ?? 'pas une feuille de polices' });
        continue;
      }
      if (!report.hosted.includes(href)) report.hosted.push(href);
      html = html.replace(tag, '');
      styles.push(result.css);
      preloads.push(...result.preload);
      changed = true;
    }
    if (!changed) continue;
    // Les connexions préparées vers Google ne servent plus à rien si toutes ses feuilles sont parties.
    if (!externalStylesheets(html).some(({ href }) => /fonts\.googleapis\.com/.test(href))) {
      html = html.replace(/[ \t]*<link\b[^>]*rel=["']?preconnect["']?[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/gi, '');
    }
    const head = [
      ...[...new Set(preloads)].slice(0, 2).map((href) => `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin />`),
      `<style data-idem-fonts>\n${styles.join('\n')}\n</style>`,
    ].join('\n    ');
    // Après `<meta charset>` et `viewport` : le jeu de caractères doit rester dans les premiers octets du document.
    const anchor = html.match(/<meta\s+name="viewport"[^>]*>/i) ?? html.match(/<meta\s+charset[^>]*>/i);
    html = anchor ? html.replace(anchor[0], `${anchor[0]}\n    ${head}`) : html.replace(/<head>/i, `<head>\n    ${head}`);
    writeFileSync(file, html);
  }
  report.files = existsSync(join(dist, 'assets/fonts')) ? readdirSync(join(dist, 'assets/fonts')).length : 0;
  return report;
}

/* -------------------------------------------------------------------------- */
/*  2. CSS dans la page                                                        */
/* -------------------------------------------------------------------------- */

function inlineStylesheets(pages, { dist, maxBytes = INLINE_CSS_MAX_BYTES }) {
  const report = { inlined: [], kept: [] };
  for (const file of pages) {
    let html = readFileSync(file, 'utf8');
    let changed = false;
    for (const match of [...html.matchAll(/<link\b[^>]*>/gi)]) {
      const tag = match[0];
      const href = attr(tag, 'href') ?? '';
      if (!/\brel\s*=\s*["']?stylesheet/i.test(tag) || !href.startsWith('/') || href.startsWith('//')) continue;
      const path = join(dist, href.split(/[?#]/)[0]);
      if (!existsSync(path)) continue;
      const size = statSync(path).size;
      if (size > maxBytes) {
        if (!report.kept.includes(href)) report.kept.push(href);
        continue;
      }
      // `</style` dans la feuille fermerait la balise : il n'y en a pas dans une sortie Tailwind, mais on s'en garde.
      const css = readFileSync(path, 'utf8').replace(/<\/style/gi, '<\\/style');
      html = html.replace(tag, `<style data-idem-inline="${href}">${css}</style>`);
      if (!report.inlined.includes(href)) report.inlined.push(href);
      changed = true;
    }
    if (changed) writeFileSync(file, html);
  }
  return report;
}

/* -------------------------------------------------------------------------- */
/*  3. Contrôle du HTML final                                                 */
/* -------------------------------------------------------------------------- */

const text = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/**
 * Ce qu'un moteur de recherche lit de chaque page. `pages` : `[{ path, html }]` (adresse publique, HTML final).
 * Les erreurs privent la page de son référencement ; les avertissements le dégradent.
 */
export function auditPages(pages, { url = '', sitemap = null } = {}) {
  const errors = [];
  const warnings = [];
  const titles = new Map();

  for (const { path, html } of pages) {
    const at = (message) => `${path} : ${message}`;
    const title = decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
    if (!title) errors.push(at('pas de titre (<title>)'));
    else {
      if (title.length > 65) warnings.push(at(`titre long (${title.length} caractères, ~60 conseillés)`));
      const lang = html.match(/<html[^>]*\slang="([^"]*)"/i)?.[1] ?? '';
      const key = `${lang}|${title}`;
      titles.set(key, [...(titles.get(key) ?? []), path]);
    }

    const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]?.trim() ?? '';
    if (!description) errors.push(at('pas de description (<meta name="description">)'));
    else if (decode(description).length > 170) warnings.push(at(`description longue (${decode(description).length} caractères, ~155 conseillés)`));

    if (!/<html[^>]*\slang="[^"]+"/i.test(html)) warnings.push(at('langue du document absente (<html lang>)'));

    const root = html.match(/<div id="root">([\s\S]*)<\/div>\s*(?:<script|<\/body>)/i)?.[1] ?? '';
    const words = text(root).split(' ').filter(Boolean).length;
    if (words < 20) errors.push(at(`page non pré-rendue : ${words} mot(s) lisibles sans JavaScript`));

    const h1 = (root.match(/<h1[\s>]/gi) ?? []).length;
    if (h1 === 0 && words >= 20) errors.push(at('aucun titre principal (<h1>)'));
    if (h1 > 1) warnings.push(at(`${h1} titres principaux (<h1>) : un seul conseillé`));

    const images = [...root.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
    const noAlt = images.filter((tag) => attr(tag, 'alt') === null).length;
    if (noAlt) warnings.push(at(`${noAlt} image(s) sans texte alternatif (alt)`));

    if (url && !/<link rel="canonical"/i.test(html)) warnings.push(at('pas d’adresse canonique'));
  }

  for (const [key, paths] of titles) if (paths.length > 1) warnings.push(`même titre « ${key.split('|')[1]} » sur ${paths.join(', ')}`);

  if (sitemap !== null) {
    const listed = (sitemap.match(/<loc>/g) ?? []).length;
    if (listed < pages.length) warnings.push(`plan du site incomplet : ${listed} adresse(s) pour ${pages.length} page(s)`);
  }
  if (!url) warnings.push('adresse publique du site inconnue (src/site/seo.json → url) : plan du site en adresses relatives, pas de canonique');

  return { errors, warnings };
}

/* -------------------------------------------------------------------------- */
/*  Assemblage                                                                */
/* -------------------------------------------------------------------------- */

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
};

export async function postbuild({ root = process.cwd(), fetchImpl = fetch, strict = process.env.IDEM_BUILD_STRICT === '1' } = {}) {
  const dist = join(root, DIST);
  const pages = htmlFiles(dist);
  const manifest = readJson(join(root, 'src/site/pages.json'), { languages: [] });
  const languages = manifest.languages?.length ? manifest.languages : [...new Set(pages.map((file) => readFileSync(file, 'utf8').match(/<html[^>]*\slang="([^"]+)"/i)?.[1]).filter(Boolean))];
  const seo = readJson(join(root, 'src/site/seo.json'), {});
  const prerender = readJson(join(root, PRERENDER_REPORT), { rendered: [], failed: [] });

  const designSystem = readJson(join(root, 'src/design-system/design-system.json'), null);
  const fonts = await selfHostFonts(pages, { dist, languages, preloadFaces: designSystem ? preloadFacesOf(designSystem) : null, fetchImpl });
  const css = inlineStylesheets(pages, { dist });

  const sitemapPath = join(dist, 'sitemap.xml');
  const audit = auditPages(
    pages.map((file) => ({ path: `/${relative(dist, file).split('\\').join('/')}`.replace(/index\.html$/, ''), html: readFileSync(file, 'utf8') })),
    { url: seo.url || '', sitemap: existsSync(sitemapPath) ? readFileSync(sitemapPath, 'utf8') : null }
  );
  for (const failure of prerender.failed ?? []) audit.errors.unshift(`${failure.path} : pré-rendu impossible (${failure.error})`);

  const report = { generatedAt: new Date().toISOString(), pages: pages.length, prerender, fonts, css, seo: audit };
  mkdirSync(join(root, dirname(REPORT)), { recursive: true });
  writeFileSync(join(root, REPORT), `${JSON.stringify(report, null, 2)}\n`);
  rmSync(join(root, PRERENDER_REPORT), { force: true });

  const lines = [
    `Pages : ${pages.length} · polices servies par le site : ${fonts.hosted.length}${fonts.kept.length ? ` (${fonts.kept.length} gardée(s) en lien externe)` : ''} · CSS dans la page : ${css.inlined.length ? 'oui' : 'non'}`,
    ...audit.errors.map((line) => `  ERREUR ${line}`),
    ...audit.warnings.map((line) => `  attention ${line}`),
  ];
  console.log(`[référencement] ${lines.join('\n')}`);
  if (strict && audit.errors.length) {
    console.error(`[référencement] ${audit.errors.length} erreur(s) : construction refusée (IDEM_BUILD_STRICT=1).`);
    process.exitCode = 1;
  }
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await postbuild();
}
