/**
 * Ce que le code écrit dans un site : le socle (template + design system de
 * départ) et l'assemblage des pages.
 *
 * Assembler une page n'est pas la composer : la page importe ses sections dans
 * l'ordre du manifeste, entre l'en-tête et le pied de page, chacune isolée par
 * une frontière d'erreur. Tout ce qui se voit est écrit par les agents.
 */

import { ProjectModel } from '../types/project.js';
import { awaitingBody } from '../scaffold/awaiting.js';
import { packageName, projectTitle } from '../scaffold/shared.js';
import { seedDesignSystemFiles } from './designConfig.js';
import { ManifestPage, SiteManifest } from './manifest.js';
import { renderBrandModule, BrandSource } from './siteData.js';
import {
  DESIGN_SYSTEM_PATHS,
  FUNCTIONAL_DEPENDENCIES,
  SITE_DEPENDENCIES,
  SITE_DEV_DEPENDENCIES,
  templateFiles,
} from './template.js';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sortKeys = (record: Record<string, string>) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

/**
 * Le manifeste du site. Les dépendances fonctionnelles (formulaires, dates, carrousel, validation) y sont TOUJOURS :
 * elles font partie de l'instantané préinstallé, si bien qu'un site qui s'en sert ne déclenche jamais d'`npm install`
 * — c'était la première cause d'un démarrage de plusieurs minutes après une génération.
 */
export function renderPackageJson(projectData: ProjectModel | undefined): string {
  const extra = FUNCTIONAL_DEPENDENCIES;
  return `${JSON.stringify(
    {
      name: packageName(projectData),
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        // Construction, pré-rendu, puis polices servies par le site, CSS dans la page et contrôle du HTML final
        // (bilan dans `.idem/build-report.json`, jamais publié).
        build: 'vite build && node scripts/prerender.mjs && node scripts/postbuild.mjs',
        preview: 'vite preview',
      },
      dependencies: sortKeys({ ...SITE_DEPENDENCIES, ...extra }),
      devDependencies: sortKeys(SITE_DEV_DEPENDENCIES),
    },
    null,
    2
  )}\n`;
}

/** Le document HTML d'une page : titre, description et balises de partage écrits dans le HTML servi. */
export function renderDocument(options: {
  language: string;
  siteName: string;
  title: string;
  description: string;
  entry: string;
  themeColor?: string;
  /** L'icône du site (favicon, icône Apple), quand elle est connue (refonte : celle de l'ancien site). */
  icons?: { favicon?: string; appleIcon?: string; ogImage?: string };
  /** La même page dans chaque langue du site (la principale en tête) : balises `hreflang`. */
  alternates?: { lang: string; href: string }[];
}): string {
  const title = escapeHtml(options.title);
  const alternates =
    options.alternates && options.alternates.length > 1
      ? [...options.alternates, { lang: 'x-default', href: options.alternates[0].href }]
          .map((alt) => `    <link rel="alternate" hreflang="${alt.lang}" href="${escapeHtml(alt.href)}" />\n`)
          .join('')
      : '';
  const description = escapeHtml(options.description);
  return `<!doctype html>
<html lang="${options.language}"${/^(ar|fa|he|ur)$/.test(options.language) ? ' dir="rtl"' : ''}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
${options.themeColor ? `    <meta name="theme-color" content="${options.themeColor}" />\n` : ''}    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(options.siteName)}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:locale" content="${options.language}" />
    <meta name="twitter:card" content="summary_large_image" />
${alternates}${options.icons?.favicon ? `    <link rel="icon" href="${escapeHtml(options.icons.favicon)}" />\n` : ''}${options.icons?.appleIcon ? `    <link rel="apple-touch-icon" href="${escapeHtml(options.icons.appleIcon)}" />\n` : ''}${options.icons?.ogImage ? `    <meta property="og:image" content="${escapeHtml(options.icons.ogImage)}" />\n` : ''}    <!-- idem:fonts -->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${options.entry}"></script>
  </body>
</html>
`;
}

/**
 * Point d'entrée d'une page : reprend le HTML pré-rendu s'il existe, sinon rend.
 *
 * `LazyMotion` fournit les fonctions d'animation à toute la page : à la construction, le plugin Motion du template
 * (`scripts/motion/vite-plugin.mjs`) remplace `motion` par son jumeau léger `m` et, si le site n'anime ni glisser ni
 * disposition, `domMax` par `domAnimation`. Sans ce plugin (un site resté sur un template d'avant), l'entrée marche
 * telle quelle : toutes les fonctions, rien de réécrit. `__IDEM_HYDRATING__` dit aux sections différées
 * (`SectionBoundary defer`) que la page est reprise d'un HTML pré-rendu.
 */
export function renderEntry(pageKey: string): string {
  return `import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { LazyMotion, MotionConfig, domMax } from 'motion/react';
import { motionTokens } from '@/design-system';
import Page from '../pages/${pageKey}.tsx';
import '../styles/index.css';

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion={motionTokens.respectReducedMotion ? 'user' : 'never'}>
        <Page />
      </MotionConfig>
    </LazyMotion>
  </StrictMode>
);

if (root.hasChildNodes()) {
  (window as Window & { __IDEM_HYDRATING__?: boolean }).__IDEM_HYDRATING__ = true;
  hydrateRoot(root, app);
} else createRoot(root).render(app);
`;
}

/**
 * La page d'attente du site.
 *
 * L'aperçu démarre avant la fin de la génération (voir `warmStart.ts` côté
 * atelier) : cette page est la première chose que l'utilisateur voit de son
 * site. Elle en montre la forme — en-tête, titre, grande image, trois blocs —
 * dans les couleurs du projet, et la première page écrite la remplace par
 * rechargement à chaud.
 *
 * Sans composant du design system : ils sont justement ce que le moteur du site
 * est en train d'écrire, et un import vers un fichier encore absent donnerait un
 * écran d'erreur Vite à la place de l'attente.
 */
const placeholderPage = (projectData: ProjectModel | undefined, language: string): string =>
  `/* idem:placeholder — remplacé par la première génération */
export default function Page() {
  return (
${awaitingBody({ target: 'site', projectData, language })}
  );
}
`;

/** Un composant de la page, écrit ou seulement conservé (il ne compilait pas). */
export interface PageEntry {
  name: string;
  ok: boolean;
}

const SKIPPED = 'idem:skipped';

/** L'import d'un composant ; commenté (avec sa marque) s'il n'est pas affiché. */
const importLine = (name: string, path: string, ok: boolean) =>
  `${ok ? '' : `// ${SKIPPED} `}import ${name} from '${path}';`;

/**
 * Sa place dans la page ; un commentaire marqué s'il n'est pas affiché, pour qu'une correction l'y remette.
 * `defer` : hydratée à l'approche de l'écran (tout sauf l'en-tête et la première section, voir `SectionBoundary`).
 */
const slot = (name: string, element: string, ok: boolean, indent: string, defer = false) =>
  ok
    ? `${indent}<SectionBoundary name="${name}"${defer ? ' defer' : ''}>\n${indent}  ${element}\n${indent}</SectionBoundary>`
    : `${indent}{/* ${SKIPPED}${defer ? ' defer' : ''} ${element} */}`;

/**
 * Une page assemblée : en-tête, sections dans l'ordre du manifeste, pied de
 * page. Un composant qui ne compile pas garde sa place, commentée.
 */
export function renderPage(
  page: ManifestPage,
  sections: PageEntry[],
  frame: { header: boolean; footer: boolean } = { header: true, footer: true }
): string {
  const imports = [
    importLine('SiteHeader', '@/components/site/SiteHeader.tsx', frame.header),
    importLine('SiteFooter', '@/components/site/SiteFooter.tsx', frame.footer),
    "import SectionBoundary from '@/components/site/section-boundary';",
    ...sections.map((entry) => importLine(entry.name, `@/sections/${page.key}/${entry.name}.tsx`, entry.ok)),
  ];

  return `/**
 * Page « ${page.label.replace(/\*\//g, '')} » (${page.path}), assemblée par IDEM : ses sections, dans l'ordre.
 */
${imports.join('\n')}

export default function ${pageComponentName(page)}() {
  return (
    <>
${slot('SiteHeader', `<SiteHeader current="${page.path}" />`, frame.header, '      ')}
      <main id="contenu">
${sections.map((entry, index) => slot(entry.name, `<${entry.name} />`, entry.ok, '        ', index > 0)).join('\n')}
      </main>
${slot('SiteFooter', '<SiteFooter />', frame.footer, '      ', true)}
    </>
  );
}
`;
}

/**
 * L'APERÇU EN DIRECT — la marque d'un composant pas encore écrit. Les pages sont posées dès que le manifeste existe,
 * chacune avec toutes ses sections : celles qui ne sont pas prêtes y tiennent leur place sous cette forme, et chaque
 * section terminée remplace la sienne par rechargement à chaud. L'utilisateur voit son site se remplir section par
 * section au lieu d'une page d'attente jusqu'à la fin.
 *
 * Aucun import : un squelette ne peut ni manquer une dépendance ni planter. Seuls les jetons du design system
 * (`bg-muted`, `rounded-card`, `max-w-content`…), donc aux couleurs du projet dès que la charte est compilée.
 */
export const PENDING_MARK = 'idem:pending';

const bar = (classes: string) => `<div className="${classes} animate-pulse rounded bg-muted" />`;

export function renderPendingSection(name: string, options: { opening: boolean; media: boolean; fr: boolean }): string {
  const label = options.fr ? 'Section en cours d’écriture' : 'Section being written';
  const text = options.opening
    ? `${bar('h-10 w-4/5 max-w-2xl')}\n          ${bar('h-10 w-3/5 max-w-xl')}\n          ${bar('mt-2 h-4 w-full max-w-lg')}\n          ${bar('h-4 w-2/3 max-w-md')}\n          <div className="mt-4 h-control w-40 animate-pulse rounded-button bg-muted" />`
    : `${bar('h-7 w-2/3 max-w-xl')}\n          ${bar('h-4 w-full max-w-2xl')}\n          ${bar('h-4 w-1/2 max-w-lg')}`;
  const visual = options.media
    ? `\n        <div className="${options.opening ? 'aspect-[16/9]' : 'aspect-[4/3]'} w-full animate-pulse rounded-card bg-muted" />`
    : options.opening
      ? ''
      : `\n        <div className="grid gap-6 sm:grid-cols-3">\n          ${Array.from({ length: 3 }, () => '<div className="h-40 animate-pulse rounded-card bg-muted" />').join('\n          ')}\n        </div>`;
  return `/* ${PENDING_MARK} — remplacé dès que cette section est écrite */
export default function ${name}() {
  return (
    <section aria-busy="true" aria-label="${label}" className="py-section">
      <div className="mx-auto grid max-w-content gap-8 px-gutter${options.opening && options.media ? ' md:grid-cols-2 md:items-center' : ''}">
        <div className="flex flex-col gap-3">
          ${text}
        </div>${visual}
      </div>
    </section>
  );
}
`;
}

/** L'en-tête ou le pied de page en attente : la même place, sans contenu. */
export function renderPendingShell(kind: 'header' | 'footer'): string {
  if (kind === 'header')
    return `/* ${PENDING_MARK} — remplacé dès que l'en-tête est écrit */
export default function SiteHeader(_props: { current?: string }) {
  return (
    <header aria-busy="true" className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-6 px-gutter">
        ${bar('h-6 w-32')}
        <div className="hidden items-center gap-6 md:flex">
          ${Array.from({ length: 4 }, () => bar('h-3 w-16')).join('\n          ')}
        </div>
      </div>
    </header>
  );
}
`;
  return `/* ${PENDING_MARK} — remplacé dès que le pied de page est écrit */
export default function SiteFooter() {
  return (
    <footer aria-busy="true" className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-content gap-6 px-gutter py-12 sm:grid-cols-3">
        ${Array.from({ length: 3 }, () => `<div className="flex flex-col gap-3">${bar('h-4 w-24')}${bar('h-3 w-32')}${bar('h-3 w-20')}</div>`).join('\n        ')}
      </div>
    </footer>
  );
}
`;
}

/** Remet dans une page les composants désormais corrigés. Rend la page inchangée s'il n'y en a pas. */
export function restoreInPage(page: string, names: string[]): string {
  let out = page;
  for (const name of names) {
    out = out.replace(new RegExp(`^// ${SKIPPED} (import ${name} from [^\\n]+)$`, 'm'), '$1');
    out = out.replace(
      new RegExp(`^(\\s*)\\{/\\* ${SKIPPED}( defer)? (<${name}\\b[^*]*?/>) \\*/\\}$`, 'm'),
      (_match, indent: string, defer: string | undefined, element: string) =>
        `${indent}<SectionBoundary name="${name}"${defer ? ' defer' : ''}>\n${indent}  ${element}\n${indent}</SectionBoundary>`
    );
  }
  return out;
}

const pageComponentName = (page: ManifestPage) =>
  `${page.key
    .split('-')
    // Un morceau vide (tiret final, tirets doublés) faisait planter l'assemblage en fin de génération.
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
    .replace(/^(\d)/, 'P$1')}Page`;

/**
 * La liste des pages du site : leur adresse, leur langue, leur module, leur titre et leur description. Les
 * documents HTML des pages en sont fabriqués par le template (`scripts/pages/vite-plugin.mjs`), dans l'aperçu comme
 * à la construction : ils ne sont plus des fichiers du projet. Un site en comptait un par page et par langue, chacun
 * dans son dossier à la racine (`a-propos/index.html`, `en/a-propos/index.html`…) : des dizaines pour une refonte,
 * et l'explorateur saturé.
 */
export const PAGES_PATH = 'src/site/pages.json';
/** La liste des pages d'un site d'avant (avec un document par page à la racine). */
export const LEGACY_PAGES_PATH = 'idem.pages.json';

/** La liste des pages d'un site, quelle que soit sa génération. */
export const pagesFileOf = (files: Record<string, string> | undefined): string | undefined => files?.[PAGES_PATH] ?? files?.[LEGACY_PAGES_PATH];

/** Le document d'une page dans une langue (son chemin dans `dist/`) : `index.html`, `a-propos/index.html`, `en/a-propos/index.html`. */
const pageHtml = (page: ManifestPage, lang: string, main: string) =>
  `${lang === main ? '' : `${lang}/`}${page.key === 'home' ? 'index.html' : `${page.key}/index.html`}`;

/** L'adresse d'une page dans une langue : `/a-propos/`, `/en/a-propos/`. */
const pageAddress = (page: ManifestPage, lang: string, main: string) => (lang === main ? page.path : `/${lang}${page.path}`);

export interface SitePageEntry {
  path: string;
  lang: string;
  module: string;
  entry: string;
  html: string;
  title: string;
  description: string;
}

/**
 * Le document de l'accueil (`index.html`, le seul fichier HTML du site : l'en-tête commun dont les autres pages sont
 * faites), les points d'entrée et la liste des pages — dans chaque langue du site : une langue de plus, ce sont des
 * lignes de plus dans la liste, avec la langue, le titre et la description traduits. Le point d'entrée est le même :
 * la langue est celle du document (`src/i18n`).
 */
export function renderPageShells(options: {
  manifest: SiteManifest;
  language: string;
  siteName: string;
  description: string;
  themeColor?: string;
  icons?: { favicon?: string; appleIcon?: string; ogImage?: string };
  /** Les langues du site, la principale en tête (par défaut : la seule `language`). */
  languages?: string[];
  /** Un texte dans une langue (le catalogue) ; l'original quand il manque. */
  translate?: (lang: string, text: string) => string;
}): Record<string, string> {
  const main = options.language;
  const languages = options.languages?.length ? options.languages : [main];
  const tr = (lang: string, text: string) => (lang === main || !options.translate ? text : options.translate(lang, text));
  const files: Record<string, string> = {};
  const entries: SitePageEntry[] = [];
  for (const lang of languages) {
    for (const page of options.manifest.pages) {
      entries.push({
        path: pageAddress(page, lang, main),
        lang,
        module: `src/pages/${page.key}.tsx`,
        entry: `/src/entries/${page.key}.tsx`,
        html: pageHtml(page, lang, main),
        title: page.seoTitle ? tr(lang, page.seoTitle) : page.key === 'home' ? options.siteName : `${tr(lang, page.label)} | ${options.siteName}`,
        description: tr(lang, page.seoDescription || options.description),
      });
    }
  }
  for (const page of options.manifest.pages) files[`src/entries/${page.key}.tsx`] = renderEntry(page.key);
  const home = entries.find((entry) => entry.html === 'index.html') ?? entries[0];
  // Les liens entre langues (`hreflang`) ne s'écrivent pas ici : le template les pose après le traitement de Vite
  // (écrits dans le document, `href="/"` faisait échouer la construction).
  files['index.html'] = renderDocument({
    language: main,
    siteName: options.siteName,
    title: home?.title ?? options.siteName,
    description: home?.description ?? options.description,
    entry: home?.entry ?? '/src/entries/home.tsx',
    themeColor: options.themeColor,
    icons: options.icons,
  });
  files[PAGES_PATH] = `${JSON.stringify({ languages, pages: entries }, null, 2)}\n`;
  return files;
}

/** Les textes des documents à traduire (titres et descriptions des pages). */
export function shellMessages(manifest: SiteManifest, description: string): string[] {
  return [...new Set(manifest.pages.flatMap((page) => [page.seoTitle, page.label, page.seoDescription]).concat(description).filter((text): text is string => !!text && !!text.trim()))];
}

export interface SiteScaffold {
  files: Record<string, string>;
  /** Écrits par le code, jamais par le modèle. */
  locked: string[];
}

/**
 * Le socle monté dans l'atelier avant la génération : le template, un design
 * system de départ tiré de la charte, la marque, une page d'attente.
 */
export function buildSiteScaffold(
  projectData: ProjectModel | undefined,
  language: string,
  brand?: { source?: BrandSource; file?: { path: string; content: string } }
): SiteScaffold {
  const name = projectTitle(projectData);
  const description = (projectData?.description ?? '').trim().slice(0, 300) || name;
  const template = templateFiles();

  const locked: Record<string, string> = {
    ...template,
    'package.json': renderPackageJson(projectData),
    'src/site/brand.tsx': renderBrandModule(projectData, name, brand?.source),
    ...(brand?.file ? { [brand.file.path]: brand.file.content } : {}),
  };

  return {
    files: {
      ...locked,
      ...seedDesignSystemFiles(projectData),
      'index.html': renderDocument({ language, siteName: name, title: name, description, entry: '/src/entries/home.tsx' }),
      'src/entries/home.tsx': renderEntry('home'),
      'src/pages/home.tsx': placeholderPage(projectData, language),
      'src/site/data.ts': `export const site = ${JSON.stringify({ name, description }, null, 2)};\n`,
    },
    // Le design system du projet n'est pas verrouillé : design-system.json se
    // modifie dans la conversation, et ses fichiers compilés suivent.
    locked: Object.keys(locked).filter((path) => !Object.values(DESIGN_SYSTEM_PATHS).includes(path as never)),
  };
}

/**
 * Les pages de chaque langue d'un site déjà généré, refaites depuis celles de la langue principale (titre,
 * description ; couleur et icônes reprises de `index.html`) : ce que `/translate` écrit quand une langue s'ajoute.
 * Un site d'avant (un document par page à la racine) garde sa forme : ses documents sont réécrits, sans les liens
 * entre langues qui faisaient échouer sa construction.
 */
export function shellsFromFiles(
  files: Record<string, string>,
  languages: string[],
  translate: (lang: string, text: string) => string
): { files: Record<string, string>; texts: string[] } {
  const legacy = typeof files[PAGES_PATH] !== 'string';
  let pages: Array<Partial<SitePageEntry> & { path: string; module: string }> = [];
  try {
    const parsed = JSON.parse(pagesFileOf(files) ?? '{}');
    const main = Array.isArray(parsed.languages) && parsed.languages.length ? parsed.languages[0] : languages[0];
    pages = (parsed.pages ?? []).filter((page: { lang?: string }) => !page.lang || page.lang === main);
  } catch {
    return { files: {}, texts: [] };
  }
  if (!pages.length) return { files: {}, texts: [] };
  const attr = (html: string, pattern: RegExp) => (html.match(pattern)?.[1] ?? '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const home = files['index.html'] ?? '';
  const manifestPages: ManifestPage[] = pages.map((page) => {
    // Le titre et la description : dans la liste (site actuel), ou dans le document de la page (site d'avant).
    const html = legacy ? (files[page.html ?? ''] ?? '') : '';
    const key = page.module.replace(/^src\/pages\//, '').replace(/\.tsx$/, '');
    return {
      key,
      path: page.path,
      label: key,
      purpose: '',
      seoTitle: legacy ? attr(html, /<title>([^<]*)<\/title>/) : (page.title ?? ''),
      seoDescription: legacy ? attr(html, /<meta name="description" content="([^"]*)"/) : (page.description ?? ''),
      sections: [],
    };
  });
  const texts = manifestPages.flatMap((page) => [page.seoTitle, page.seoDescription]).filter((text): text is string => !!text);
  const options = {
    manifest: { pages: manifestPages, header: '', footer: '', components: [], dependencies: [], keywords: [], businessType: '', languages: languages.slice(1) },
    language: languages[0],
    siteName: attr(home, /<meta property="og:site_name" content="([^"]*)"/),
    description: attr(home, /<meta name="description" content="([^"]*)"/),
    themeColor: attr(home, /<meta name="theme-color" content="([^"]*)"/) || undefined,
    icons: {
      favicon: attr(home, /<link rel="icon" href="([^"]*)"/) || undefined,
      appleIcon: attr(home, /<link rel="apple-touch-icon" href="([^"]*)"/) || undefined,
      ogImage: attr(home, /<meta property="og:image" content="([^"]*)"/) || undefined,
    },
    languages,
    translate,
  };
  const shells = renderPageShells(options);
  // Les points d'entrée existent déjà : seuls les documents et la liste des pages changent.
  if (!legacy) return { files: Object.fromEntries(Object.entries(shells).filter(([path]) => !path.startsWith('src/entries/'))), texts };

  // Site d'avant : un document par page et par langue, et sa liste à l'ancienne place.
  const entries = JSON.parse(shells[PAGES_PATH]).pages as SitePageEntry[];
  const legacyFiles: Record<string, string> = { [LEGACY_PAGES_PATH]: `${JSON.stringify({ languages, pages: entries.map(({ path, module, html, lang }) => ({ path, module, html, lang })) }, null, 2)}\n` };
  for (const entry of entries) {
    legacyFiles[entry.html] = renderDocument({ language: entry.lang, siteName: options.siteName, title: entry.title, description: entry.description, entry: entry.entry, themeColor: options.themeColor, icons: options.icons });
  }
  return { files: legacyFiles, texts };
}
