/**
 * Starter « site vitrine » — Vite, une page HTML par page.
 *
 * Next avait été choisi pour le référencement. Il s'est révélé inutilisable là
 * où le site doit tourner : dans une WebContainer, le contexte
 * `AsyncLocalStorage` se perd à travers l'ordonnanceur de React, et le rendu
 * serveur de `next dev` tombe sur une erreur interne — quelle que soit la
 * version. Un aperçu qui ne s'affiche pas ne vaut aucun référencement.
 *
 * D'où ce socle : un site multi-pages Vite. Chaque page a son propre fichier
 * HTML, avec son titre, sa description et ses balises de partage écrits dans le
 * document servi. Les robots les lisent sans exécuter une ligne de JavaScript,
 * et la navigation entre pages est faite de vrais liens.
 *
 * Ce qui reste du côté navigateur : le corps de la page. Un robot qui n'exécute
 * pas JavaScript voit donc les balises mais pas le texte des sections. C'est le
 * compromis assumé en échange d'un aperçu instantané et éprouvé.
 */

import { DesignSystem } from '../design/tokenForge.js';
import { ProjectModel } from '../types/project.js';
import { renderLibraryManifest } from './libraries.js';
import { buildSectionKit, sectionDefaults } from './sections.js';
import {
  CN_HELPER,
  CN_UTILS,
  JSCONFIG,
  POSTCSS_CONFIG,
  buildBaseCss,
  BrandLogoSource,
  buildBrandMark,
  buildPackageJson,
  buildTailwindConfig,
  buildUiKit,
  componentsJson,
  fontLinks,
  projectTitle,
} from './shared.js';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Configuration Vite.
 *
 * Deux choses la distinguent d'un projet à page unique : la liste des entrées
 * HTML, découverte à la volée pour qu'ajouter une page ne demande aucune
 * modification de configuration, et la lecture du JSX dans les fichiers `.js`.
 */
const VITE_CONFIG = `import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Une entrée par page : index.html à la racine, puis chaque dossier qui
 * contient son propre index.html. Ajouter une page, c'est ajouter un dossier.
 */
function pages() {
  const entries = { index: here('index.html') };
  const ignored = new Set(['node_modules', 'src', 'dist', 'public', 'scripts', '.git']);

  for (const item of readdirSync(here('.'), { withFileTypes: true })) {
    if (!item.isDirectory() || ignored.has(item.name) || item.name.startsWith('.')) continue;
    const page = here(item.name + '/index.html');
    if (existsSync(page)) entries[item.name] = page;
  }

  return entries;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': here('src') },
  },
  // Les .js de src/ sont lus comme du JSX : une balise dans un fichier de
  // données ne doit pas faire tomber le site entier.
  esbuild: {
    loader: 'jsx',
    include: new RegExp('src/.*[.][jt]sx?$'),
    exclude: [],
  },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
  build: { rollupOptions: { input: pages() } },
  server: { host: true, port: 5173 },
});
`;

/** Liens internes : de vrais liens, puisque chaque page est un document. */
const LINK_ADAPTER = `/**
 * Chaque page du site est un document à part entière : un lien interne est donc
 * un lien, sans routeur ni interception.
 */
export default function Link({ href, children, ...props }) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
`;

/**
 * Le gabarit d'une page.
 *
 * Le compositeur le remplit pour chaque page du plan : titre, description,
 * point d'entrée. Les polices et la couleur de marque y sont déjà, écrites par
 * le code — elles ne dépendent pas de la page.
 */
function buildPageTemplate(
  system: DesignSystem,
  projectData: ProjectModel | undefined,
  language: string
): string {
  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{title}}</title>
    <meta name="description" content="{{description}}" />
    <meta name="theme-color" content="${system.colors.brand['600']}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(projectTitle(projectData))}" />
    <meta property="og:title" content="{{title}}" />
    <meta property="og:description" content="{{description}}" />
    <meta property="og:locale" content="${language}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{{title}}" />
    <meta name="twitter:description" content="{{description}}" />
{{fonts}}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="{{entry}}"></script>
  </body>
</html>
`;
}

/** Point d'entrée d'une page : monter le composant, rien d'autre. */
/**
 * Point d'entrée d'une page.
 *
 * `hydrateRoot` et non `createRoot` : le HTML est déjà écrit dans le document
 * par le pré-rendu, et React le reprend au lieu de le jeter. C'est ce qui fait
 * qu'un moteur de recherche voit le texte, et que l'utilisateur ne voit pas la
 * page clignoter.
 */
const ENTRY_TEMPLATE = `import { hydrateRoot } from 'react-dom/client';
import Page from '../pages/{{name}}.jsx';
import '../styles/index.css';

hydrateRoot(document.getElementById('root'), <Page />);
`;

const PLACEHOLDER_PAGE = `/* idem:placeholder — remplacé par la première génération */
import { Section } from '../ui/index.js';

export default function Page() {
  return (
    <main>
      <Section>
        <p className="text-ink-muted">Espace de travail prêt.</p>
      </Section>
    </main>
  );
}
`;

/**
 * Référencement du site : ce que le code sait déjà, et ce que l'étape dédiée
 * remplira après la génération.
 */
function buildSeoConfig(
  projectData: ProjectModel | undefined,
  system: DesignSystem,
  language: string
): string {
  const name = projectTitle(projectData);
  const description = (projectData?.description ?? '').trim().slice(0, 300) || name;

  return `/**
 * Référencement du site. Ces valeurs partent dans le HTML de chaque page.
 */
const seo = {
  name: ${JSON.stringify(name)},
  // Titre de la page d'accueil. Moins de 60 caractères.
  title: ${JSON.stringify(name)},
  // Ce que montre un résultat de recherche. 150 à 160 caractères.
  description: ${JSON.stringify(description)},
  language: ${JSON.stringify(language)},
  themeColor: ${JSON.stringify(system.colors.brand['600'])},
  // Adresse publique, renseignée à la mise en ligne.
  url: '',
  // Mots que vos clients tapent réellement.
  keywords: [],
  // Fiche d'établissement pour les moteurs de recherche.
  business: { type: '', city: '', country: '', phone: '', email: '' },
};

export default seo;
`;
}

/**
 * Pré-rendu : le référencement pour de vrai.
 *
 * Les balises de titre et de description suffisent aux réseaux sociaux, pas aux
 * moteurs. Après la construction, chaque page est rendue en HTML et écrite dans
 * son document : le texte des sections est donc là, lisible sans exécuter une
 * ligne de JavaScript. Le navigateur, lui, reprend ce HTML par hydratation.
 *
 * Trois choses sont posées au passage, qu'aucun modèle n'a à écrire : le plan
 * du site, le fichier robots, et la fiche d'établissement en données
 * structurées.
 */
const PRERENDER = `import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { renderToString } from 'react-dom/server';

const DIST = 'dist';

/** Les pages du site : adresse publique, module à rendre, document produit. */
function pages() {
  const manifest = existsSync('idem.pages.json')
    ? JSON.parse(readFileSync('idem.pages.json', 'utf8'))
    : null;

  if (manifest?.pages?.length) return manifest.pages;

  // Sans manifeste — première génération, ou plan absent — on retombe sur ce
  // que le dossier contient réellement.
  const found = [{ path: '/', module: 'src/pages/home.jsx', html: 'index.html' }];
  for (const item of readdirSync('.', { withFileTypes: true })) {
    if (!item.isDirectory() || item.name.startsWith('.')) continue;
    if (['node_modules', 'src', 'dist', 'public', 'scripts'].includes(item.name)) continue;
    if (!existsSync(join(item.name, 'index.html'))) continue;
    found.push({
      path: '/' + item.name + '/',
      module: 'src/pages/' + item.name + '.jsx',
      html: join(item.name, 'index.html'),
    });
  }
  return found;
}

/**
 * Le fichier de référencement, chargé depuis la RACINE du projet.
 *
 * Un \`import('./src/seo.js')\` se résout par rapport à ce script, donc à
 * \`scripts/src/seo.js\` : il échouait en silence, et le site partait avec des
 * données structurées vides et un plan sans adresse.
 */
const seo = existsSync('src/seo.js')
  ? (await import(pathToFileURL(resolve('src/seo.js')).href).catch((error) => {
      console.warn('[prerender] src/seo.js illisible : ' + error.message);
      return { default: {} };
    })).default ?? {}
  : {};

/** Fiche d'établissement, quand le site en dit assez pour la remplir. */
function structuredData() {
  const business = seo.business ?? {};
  const hasBusiness = business.type || business.city || business.phone;

  const data = hasBusiness
    ? {
        '@context': 'https://schema.org',
        '@type': business.type || 'LocalBusiness',
        name: seo.name,
        description: seo.description,
        url: seo.url || undefined,
        telephone: business.phone || undefined,
        email: business.email || undefined,
        address: business.city
          ? {
              '@type': 'PostalAddress',
              addressLocality: business.city,
              addressCountry: business.country || undefined,
            }
          : undefined,
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: seo.name,
        description: seo.description,
        url: seo.url || undefined,
      };

  return '<script type="application/ld+json">' + JSON.stringify(data) + '</scr' + 'ipt>';
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const list = pages();
const jsonLd = structuredData();
const base = (seo.url || '').replace(/\\/$/, '');

try {
  for (const page of list) {
    const file = join(DIST, page.html);
    if (!existsSync(file) || !existsSync(page.module)) continue;

    let markup = '';
    try {
      const mod = await vite.ssrLoadModule('/' + page.module);
      const Page = mod.default;
      if (typeof Page === 'function') markup = renderToString(Page({}));
    } catch (error) {
      // Une page qui ne se rend pas hors navigateur garde son document tel
      // quel : elle s'affichera côté client, comme avant. On ne bloque pas la
      // construction pour du référencement.
      console.warn('[prerender] ' + page.path + ' non pré-rendue : ' + error.message);
    }

    let html = readFileSync(file, 'utf8');
    if (markup) html = html.replace('<div id="root"></div>', '<div id="root">' + markup + '</div>');

    // Lien canonique posé ici, et non dans le gabarit : il demande l'adresse
    // publique du site, connue seulement à la mise en ligne. Vite, lui,
    // tenterait d'empaqueter un href local comme une ressource.
    const canonical = base
      ? '<link rel="canonical" href="' + base + page.path + '" />'
      : '';

    html = html.replace('</head>', '  ' + canonical + jsonLd + '\\n  </head>');
    writeFileSync(file, html);
  }
} finally {
  await vite.close();
}

// Plan du site et robots : l'adresse publique est renseignée à la mise en ligne.
const urls = list
  .map((page) => '  <url><loc>' + base + page.path + '</loc></url>')
  .join('\\n');

writeFileSync(
  join(DIST, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n' +
    urls +
    '\\n</urlset>\\n'
);

writeFileSync(
  join(DIST, 'robots.txt'),
  'User-agent: *\\nAllow: /\\n' + (base ? 'Sitemap: ' + base + '/sitemap.xml\\n' : '')
);

console.log('Référencement : ' + list.length + ' page(s) pré-rendue(s), plan du site et robots écrits.');
`;

const DOCKERFILE = `# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -q --spider http://localhost/ || exit 1
`;

const NGINX_CONF = `server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # Site multi-pages : chaque page est un dossier avec son index.html.
  location / {
    try_files $uri $uri/ $uri/index.html =404;
  }

  location ~* \\.(js|css|svg|png|jpg|jpeg|webp|avif|woff2)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
  }

  gzip on;
  gzip_types text/css application/javascript image/svg+xml;
}
`;

const DOCKERIGNORE = `node_modules
dist
.git
*.log
`;

export function buildSiteViteScaffold(
  system: DesignSystem,
  projectData: ProjectModel | undefined,
  language: string,
  brand?: { source?: BrandLogoSource; file?: { path: string; content: string } }
): { files: Record<string, string>; locked: string[] } {
  const template = buildPageTemplate(system, projectData, language);
  const name = projectTitle(projectData);
  const description = (projectData?.description ?? '').trim().slice(0, 300) || name;

  // La page d'accueil du socle, tirée du même gabarit que les autres.
  const home = template
    .replace(/\{\{title\}\}/g, escapeHtml(name))
    .replace(/\{\{description\}\}/g, escapeHtml(description))
    .replace('{{canonical}}', '/')
    .replace('{{fonts}}', fontLinks(system))
    .replace('{{entry}}', '/src/entries/home.jsx');

  const locked: Record<string, string> = {
    'package.json': buildPackageJson({
      projectData,
      scripts: {
        dev: 'vite',
        // Le pré-rendu suit la construction : sans lui, le HTML servi n'aurait
        // que des balises et un corps vide.
        build: 'vite build && node scripts/prerender.mjs',
        preview: 'vite preview',
      },
    }),
    'vite.config.js': VITE_CONFIG,
    'postcss.config.js': POSTCSS_CONFIG,
    'tailwind.config.js': buildTailwindConfig(system, [
      './index.html',
      './*/index.html',
      './src/**/*.{js,jsx,ts,tsx}',
    ]),
    'jsconfig.json': JSCONFIG,
    'components.json': componentsJson('src/styles/index.css'),
    'idem.libraries.json': renderLibraryManifest('site'),
    // Le gabarit sert au compositeur : une page du plan donne un document.
    'idem.page.html': template.replace('{{fonts}}', fontLinks(system)),
    'src/styles/index.css': buildBaseCss(system),
    'src/brand.jsx': buildBrandMark(projectData, brand?.source),
    // Le logo de la charte, déposé dans le projet par le serveur.
    ...(brand?.file ? { [brand.file.path]: brand.file.content } : {}),
    'src/lib/cn.js': CN_HELPER,
    'src/lib/utils.js': CN_UTILS,
    'src/sections/Link.jsx': LINK_ADAPTER,
    'scripts/prerender.mjs': PRERENDER,
    'src/entries/home.jsx': ENTRY_TEMPLATE.replace('{{name}}', 'home'),
    Dockerfile: DOCKERFILE,
    'nginx.conf': NGINX_CONF,
    '.dockerignore': DOCKERIGNORE,
    ...buildUiKit(),
  };

  const sections = buildSectionKit(sectionDefaults(system.direction));

  return {
    files: {
      ...locked,
      ...sections,
      // Le document de l'accueil n'est pas verrouillé : le compositeur le
      // réécrit avec le titre et la description de la page. Verrouillé, le
      // rafraîchissement du socle à la réouverture le remettait au gabarit nu.
      'index.html': home,
      'src/seo.js': buildSeoConfig(projectData, system, language),
      'src/pages/home.jsx': PLACEHOLDER_PAGE,
    },
    locked: Object.keys(locked),
  };
}
