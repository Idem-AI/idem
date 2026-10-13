/**
 * Starter « site vitrine » — Next.js 15, App Router, export statique.
 *
 * Pourquoi Next plutôt que Vite pour un site : le référencement. Les balises
 * de page (titre, description, partage social, données structurées) doivent
 * exister dans le HTML servi, pas être posées par du JavaScript après coup. Le
 * routage par fichiers donne en prime de vraies pages — un site n'est pas
 * toujours une page unique où la navigation fait défiler.
 *
 * Export statique (`output: 'export'`) à dessein : la mise en ligne par iDeploy
 * envoie un dossier de fichiers. Le build écrit donc dans `dist/`, exactement
 * là où la publication va déjà chercher, et rien ne change en aval.
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
  buildBrandMark,
  buildTailwindConfig,
  buildUiKit,
  componentsJson,
  packageName,
  projectTitle,
} from './shared.js';

const escapeJs = (value: string): string => JSON.stringify(value);

const NEXT_CONFIG = `/** @type {import('next').NextConfig} */
export default {
  // Site statique : le build produit des fichiers HTML, que la mise en ligne
  // envoie tels quels. Aucun serveur Node à faire tourner derrière.
  output: 'export',
  // L'optimisation d'images de Next demande un serveur : sans elle, une <img>
  // reste une <img>, ce qui est exactement ce qu'il faut ici.
  images: { unoptimized: true },
  trailingSlash: true,
};
`;

/**
 * `next build` écrit dans `out/`. La publication lit `dist/`. Plutôt que de
 * changer la publication — et de casser les sites déjà en ligne — on renomme.
 */
const TO_DIST = `import { existsSync, rmSync, renameSync } from 'node:fs';

if (!existsSync('out')) {
  console.error("Le build n'a rien produit dans out/ : export statique désactivé ?");
  process.exit(1);
}

rmSync('dist', { recursive: true, force: true });
renameSync('out', 'dist');
console.log('Site exporté dans dist/');
`;

/** `next/link` isolé ici : le kit de sections reste indépendant du framework. */
const LINK_ADAPTER = `export { default } from 'next/link';
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
 * Le référencement du site, au même endroit pour tout le monde.
 *
 * Le code en pose ce qu'il sait déjà (nom, description, langue, couleur de
 * marque). L'étape de référencement, après la génération, ne remplit que ce qui
 * demande de connaître le métier : les mots que les gens tapent, la promesse,
 * les pages à décrire une par une.
 */
function buildSeoConfig(projectData: ProjectModel | undefined, system: DesignSystem, language: string): string {
  const name = projectTitle(projectData);
  const description = (projectData?.description ?? '').trim().slice(0, 300) || name;

  return `/**
 * Référencement du site. Modifiable : chaque valeur part dans le HTML servi.
 */
const seo = {
  name: ${escapeJs(name)},
  // Repris dans <title> de chaque page : « Page — Nom du site ».
  titleTemplate: ${escapeJs(`%s — ${name}`)},
  // Titre de la page d'accueil. Moins de 60 caractères.
  title: ${escapeJs(name)},
  // Ce que montre un résultat de recherche. 150 à 160 caractères.
  description: ${escapeJs(description)},
  language: ${escapeJs(language)},
  themeColor: ${escapeJs(system.colors.brand['600'])},
  // Adresse publique, renseignée à la mise en ligne.
  url: '',
  // Mots que vos clients tapent réellement.
  keywords: [],
  // Fiche d'établissement pour les moteurs de recherche. Laisser vide si le
  // projet n'a pas d'adresse ni de téléphone.
  business: { type: '', city: '', country: '', phone: '', email: '' },
};

export default seo;
`;
}

function buildLayout(system: DesignSystem): string {
  const fontLinks = [
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />',
    ...system.fontsHrefs.map((href) => `<link rel="stylesheet" href="${href}" />`),
  ]
    .map((tag) => `        ${tag}`)
    .join('\n');

  return `import seo from '../seo.js';
import './globals.css';

/**
 * Balises communes à toutes les pages, posées dans le HTML servi.
 *
 * C'est tout l'intérêt de Next ici : un moteur de recherche lit ces balises
 * sans exécuter de JavaScript. Chaque page peut les compléter avec son propre
 * \`export const metadata\`.
 */
export const metadata = {
  title: { default: seo.title, template: seo.titleTemplate },
  description: seo.description,
  keywords: seo.keywords,
  metadataBase: seo.url ? new URL(seo.url) : undefined,
  openGraph: {
    type: 'website',
    title: seo.title,
    description: seo.description,
    siteName: seo.name,
    locale: seo.language,
  },
  twitter: { card: 'summary_large_image', title: seo.title, description: seo.description },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: seo.themeColor,
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang={seo.language}>
      <head>
${fontLinks}
      </head>
      <body>{children}</body>
    </html>
  );
}
`;
}

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

  # Export statique de Next : chaque page est un dossier avec son index.html.
  location / {
    try_files $uri $uri/ $uri/index.html /404.html;
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
out
.next
.git
*.log
`;

export function buildSiteNextScaffold(
  system: DesignSystem,
  projectData: ProjectModel | undefined,
  language: string
): { files: Record<string, string>; locked: string[] } {
  const locked: Record<string, string> = {
    'package.json': `${JSON.stringify(
      {
        name: packageName(projectData),
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: {
          dev: 'next dev',
          // `next build` exporte dans out/ ; la publication lit dist/.
          build: 'next build && node scripts/to-dist.mjs',
          start: 'next start',
          lint: 'next lint',
        },
        dependencies: {
          clsx: '^2.1.1',
          'lucide-react': '^0.441.0',
          next: '^15.1.0',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          'tailwind-merge': '^2.5.2',
        },
        devDependencies: {
          autoprefixer: '^10.4.0',
          postcss: '^8.4.0',
          tailwindcss: '^3.4.0',
        },
      },
      null,
      2
    )}\n`,
    'next.config.mjs': NEXT_CONFIG,
    'scripts/to-dist.mjs': TO_DIST,
    'postcss.config.mjs': POSTCSS_CONFIG,
    'tailwind.config.js': buildTailwindConfig(system, ['./src/**/*.{js,jsx,ts,tsx}']),
    'jsconfig.json': JSCONFIG,
    'components.json': componentsJson('src/app/globals.css'),
    'idem.libraries.json': renderLibraryManifest('site'),
    'src/app/layout.jsx': buildLayout(system),
    'src/app/globals.css': buildBaseCss(system),
    'src/brand.jsx': buildBrandMark(projectData),
    'src/lib/cn.js': CN_HELPER,
    'src/lib/utils.js': CN_UTILS,
    'src/sections/Link.jsx': LINK_ADAPTER,
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
      'src/seo.js': buildSeoConfig(projectData, system, language),
      'src/app/page.jsx': PLACEHOLDER_PAGE,
    },
    locked: Object.keys(locked),
  };
}
