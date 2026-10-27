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

export function renderPackageJson(projectData: ProjectModel | undefined, dependencies: string[] = []): string {
  const extra = Object.fromEntries(
    dependencies.filter((name) => name in FUNCTIONAL_DEPENDENCIES).map((name) => [name, FUNCTIONAL_DEPENDENCIES[name]])
  );
  return `${JSON.stringify(
    {
      name: packageName(projectData),
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build && node scripts/prerender.mjs',
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
}): string {
  const title = escapeHtml(options.title);
  const description = escapeHtml(options.description);
  return `<!doctype html>
<html lang="${options.language}">
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
${options.icons?.favicon ? `    <link rel="icon" href="${escapeHtml(options.icons.favicon)}" />\n` : ''}${options.icons?.appleIcon ? `    <link rel="apple-touch-icon" href="${escapeHtml(options.icons.appleIcon)}" />\n` : ''}${options.icons?.ogImage ? `    <meta property="og:image" content="${escapeHtml(options.icons.ogImage)}" />\n` : ''}    <!-- idem:fonts -->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${options.entry}"></script>
  </body>
</html>
`;
}

/** Point d'entrée d'une page : reprend le HTML pré-rendu s'il existe, sinon rend. */
export function renderEntry(pageKey: string): string {
  return `import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { motionTokens } from '@/design-system';
import Page from '../pages/${pageKey}.tsx';
import '../styles/index.css';

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <MotionConfig reducedMotion={motionTokens.respectReducedMotion ? 'user' : 'never'}>
      <Page />
    </MotionConfig>
  </StrictMode>
);

if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
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

/** Sa place dans la page ; un commentaire marqué s'il n'est pas affiché, pour qu'une correction l'y remette. */
const slot = (name: string, element: string, ok: boolean, indent: string) =>
  ok
    ? `${indent}<SectionBoundary name="${name}">\n${indent}  ${element}\n${indent}</SectionBoundary>`
    : `${indent}{/* ${SKIPPED} ${element} */}`;

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
${sections.map((entry) => slot(entry.name, `<${entry.name} />`, entry.ok, '        ')).join('\n')}
      </main>
${slot('SiteFooter', '<SiteFooter />', frame.footer, '      ')}
    </>
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
      new RegExp(`^(\\s*)\\{/\\* ${SKIPPED} (<${name}\\b[^*]*?/>) \\*/\\}$`, 'm'),
      (_match, indent: string, element: string) => `${indent}<SectionBoundary name="${name}">\n${indent}  ${element}\n${indent}</SectionBoundary>`
    );
  }
  return out;
}

/** Les composants qu'une page garde sans les afficher. */
export function skippedInPage(page: string): string[] {
  return Array.from(page.matchAll(new RegExp(`^// ${SKIPPED} import (\\w+) from`, 'gm'))).map((match) => match[1]);
}

const pageComponentName = (page: ManifestPage) =>
  `${page.key
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
    .replace(/^(\d)/, 'P$1')}Page`;

/** Documents, points d'entrée et manifeste de pré-rendu de toutes les pages. */
export function renderPageShells(options: {
  manifest: SiteManifest;
  language: string;
  siteName: string;
  description: string;
  themeColor?: string;
  icons?: { favicon?: string; appleIcon?: string; ogImage?: string };
}): Record<string, string> {
  const files: Record<string, string> = {};
  for (const page of options.manifest.pages) {
    const html = page.key === 'home' ? 'index.html' : `${page.key}/index.html`;
    files[html] = renderDocument({
      language: options.language,
      siteName: options.siteName,
      title: page.seoTitle || (page.key === 'home' ? options.siteName : `${page.label} | ${options.siteName}`),
      description: page.seoDescription || options.description,
      entry: `/src/entries/${page.key}.tsx`,
      themeColor: options.themeColor,
      icons: options.icons,
    });
    files[`src/entries/${page.key}.tsx`] = renderEntry(page.key);
  }
  files['idem.pages.json'] = `${JSON.stringify(
    {
      pages: options.manifest.pages.map((page) => ({
        path: page.path,
        module: `src/pages/${page.key}.tsx`,
        html: page.key === 'home' ? 'index.html' : `${page.key}/index.html`,
      })),
    },
    null,
    2
  )}\n`;
  return files;
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
