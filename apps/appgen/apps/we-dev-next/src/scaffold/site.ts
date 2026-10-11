/**
 * Starter « site vitrine » : Vite + React 18 + Tailwind v3, déjà configuré.
 *
 * Le modèle n'écrit que `src/App.jsx`, les sections et les composants du
 * produit. Tout le reste est posé ici.
 */

import { DesignSystem } from '../design/tokenForge.js';
import { ProjectModel } from '../types/project.js';
import {
  POSTCSS_CONFIG,
  VITE_CONFIG,
  buildBaseCss,
  buildPackageJson,
  buildTailwindConfig,
  buildUiKit,
  CN_HELPER,
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
 * `index.html` du site, métadonnées comprises.
 *
 * Les balises de partage sont posées par le code : elles ne demandent aucune
 * créativité, et un modèle qui les improvise écrit une description vide une
 * fois sur deux.
 */
function buildIndexHtml(
  system: DesignSystem,
  projectData: ProjectModel | undefined,
  language: string
): string {
  const title = escapeHtml(projectTitle(projectData));
  const description = escapeHtml(
    (projectData?.description ?? '').trim().slice(0, 300) || title
  );

  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="theme-color" content="${system.colors.brand['600']}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta name="twitter:card" content="summary_large_image" />
${fontLinks(system)}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

const MAIN = `import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

createRoot(document.getElementById('root')).render(<App />);
`;

/** Écran d'attente : l'aperçu démarre avant la première génération. */
const APP_PLACEHOLDER = `import { Section } from './ui/index.js';

export default function App() {
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
 * Recette de conteneur du site : construction Vite puis nginx.
 *
 * Elle était jusqu'ici demandée au modèle (`dockerfilePrompt`), qui produisait
 * en prime un `docker-compose.yml` avec des services « backend » et
 * « database » pour un site vitrine qui n'en a aucun — et que rien, ni iDeploy
 * ni la mise en ligne Netlify, ne lisait jamais. Posée par le code, elle est
 * juste, gratuite, et reste utile à qui héberge le site lui-même.
 */
const DOCKERFILE = `# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# npm install et non npm ci : le projet n'embarque pas de verrou de
# dépendances, et la construction a besoin des outils de développement (Vite).
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

  # Une page servie directement par son adresse : sans ce repli, un
  # rafraîchissement sur une route interne renvoie 404.
  location / {
    try_files $uri $uri/ /index.html;
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

export function buildSiteScaffold(
  system: DesignSystem,
  projectData: ProjectModel | undefined,
  language: string
): { files: Record<string, string>; locked: string[] } {
  const locked: Record<string, string> = {
    'package.json': buildPackageJson({
      projectData,
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    }),
    'vite.config.js': VITE_CONFIG,
    'postcss.config.js': POSTCSS_CONFIG,
    'tailwind.config.js': buildTailwindConfig(system, [
      './index.html',
      './src/**/*.{js,jsx,ts,tsx}',
    ]),
    'index.html': buildIndexHtml(system, projectData, language),
    'src/styles/index.css': buildBaseCss(system),
    'src/main.jsx': MAIN,
    'src/lib/cn.js': CN_HELPER,
    Dockerfile: DOCKERFILE,
    'nginx.conf': NGINX_CONF,
    '.dockerignore': DOCKERIGNORE,
    ...buildUiKit(),
  };

  return {
    files: { ...locked, 'src/App.jsx': APP_PLACEHOLDER },
    locked: Object.keys(locked),
  };
}
