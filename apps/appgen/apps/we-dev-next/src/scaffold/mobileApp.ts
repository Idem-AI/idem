/**
 * Starter « application mobile » : Vite + React 18 + Tailwind v3 mis en page
 * pour le téléphone, installable en PWA, emballé par Capacitor.
 *
 * Tout ce qui rendait ce gabarit coûteux à générer — manifeste, service
 * worker, icône, configuration Capacitor, cadre d'écran (barre d'onglets,
 * barre de titre), stockage local — est posé ici. Le modèle écrit les écrans,
 * la liste des onglets (`src/tabs.js`) et les données de départ.
 */

import { DesignSystem } from '../design/tokenForge.js';
import { ProjectModel } from '../types/project.js';
import { awaitingBody } from './awaiting.js';
import {
  CN_UTILS,
  JSCONFIG,
  POSTCSS_CONFIG,
  componentsJson,
  buildBaseCss,
  buildPackageJson,
  buildTailwindConfig,
  buildUiKit,
  CN_HELPER,
  fontLinks,
  packageName,
  projectTitle,
} from './shared.js';

const VITE_CONFIG_MOBILE = `import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' est obligatoire : Capacitor charge l'application depuis des
// fichiers locaux, et un chemin absolu /assets/… donne un écran blanc.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Les .js de src/ sont lus comme du JSX (voir le socle du site).
  esbuild: {
    loader: 'jsx',
    include: new RegExp('src/.*[.][jt]sx?$'),
    // Vite exclut les .js de cette transformation par défaut : sans ce
    // tableau vide, l'option ci-dessus ne s'applique à rien.
    exclude: [],
  },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
  server: { host: true, port: 5173 },
});
`;

/** `africa.idem.<nom>` : identifiant de paquet Android / iOS. */
const appId = (projectData?: ProjectModel): string =>
  `africa.idem.${packageName(projectData).replace(/-/g, '')}`;

const SW = `const CACHE = 'app-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('./index.html'))),
  );
});
`;

const MAIN = `import { createRoot } from 'react-dom/client';
// Sans extension : le produit peut être écrit en .jsx comme en .tsx.
import App from './App';
import './styles/index.css';

createRoot(document.getElementById('root')).render(<App />);

// En production seulement : dans l'aperçu, le service worker servirait des
// fichiers périmés à chaque régénération.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
`;

const APP_SHELL = `import { NavLink, Outlet } from 'react-router-dom';
import { TABS } from '../../tabs.js';

/** Cadre des écrans d'onglet : l'écran défile, la barre d'onglets reste en bas. */
export default function AppShell() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-surface text-ink">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav className="pb-safe border-t border-neutral-200 bg-surface">
        <ul className="flex">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  \`flex min-h-[56px] flex-col items-center justify-center gap-1 text-xs \${
                    isActive ? 'text-brand-700' : 'text-ink-muted'
                  }\`
                }
              >
                <Icon size={22} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
`;

const TOP_BAR = `import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/** Haut de chaque écran ; \`back\` ajoute la flèche de retour. */
export default function TopBar({ title, back = false, action = null }) {
  const navigate = useNavigate();

  return (
    <header className="pt-safe sticky top-0 z-sticky border-b border-neutral-200 bg-surface">
      <div className="flex h-14 items-center gap-2 px-2">
        {back && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="grid h-11 w-11 place-items-center"
            aria-label="Retour"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <h1 className={\`flex-1 truncate text-lg font-semibold \${back ? '' : 'px-2'}\`}>{title}</h1>
        {action}
      </div>
    </header>
  );
}
`;

const USE_STORED_STATE = `import { useEffect, useState } from 'react';

/** L'application n'a pas de serveur : ses données vivent sur le téléphone. */
export function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* stockage plein ou refusé : l'état reste en mémoire */
    }
  }, [key, value]);

  return [value, setValue];
}
`;

const TABS_PLACEHOLDER = `import { Home, User } from 'lucide-react';

/**
 * Les onglets de l'application : un par activité principale du produit.
 * \`end: true\` sur l'onglet d'accueil (route \`/\`).
 */
export const TABS = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/profile', label: 'Profil', icon: User },
];
`;

/**
 * La page d'attente, affichée dans le téléphone pendant que le modèle écrit.
 *
 * L'aperçu démarre avant la fin de la génération (voir `warmStart.ts` côté
 * atelier) : c'est donc le premier écran de l'application, et il montre la
 * forme de ce qui arrive plutôt que de dire que ça tourne. Le premier fichier
 * du modèle le remplace par rechargement à chaud.
 *
 * Hors routeur et hors coquille : la barre d'onglets du socle renvoie vers des
 * écrans qui n'existent pas encore, et un onglet qui mène à une erreur est pire
 * qu'un onglet absent.
 */
const appPlaceholder = (projectData: ProjectModel | undefined, language: string): string =>
  `/* idem:placeholder — remplacé par la première génération */
export default function App() {
  return (
${awaitingBody({ target: 'mobile-app', projectData, language })}
  );
}
`;

const SAFE_AREA_CSS = `
@layer base {
  html,
  body,
  #root {
    height: 100%;
  }

  body {
    margin: 0;
    overscroll-behavior: none;
    -webkit-tap-highlight-color: transparent;
  }
}

@layer utilities {
  .pt-safe {
    padding-top: env(safe-area-inset-top);
  }

  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
`;

/** Icône d'application : carré arrondi de la couleur de marque + initiale. */
function buildIcon(system: DesignSystem, projectData?: ProjectModel): string {
  const initial = projectTitle(projectData).trim().charAt(0).toUpperCase() || 'A';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="${initial}">
  <rect width="512" height="512" rx="112" fill="${system.colors.brand['600']}" />
  <text x="256" y="256" fill="#ffffff" font-family="system-ui, sans-serif" font-size="260" font-weight="700" text-anchor="middle" dominant-baseline="central">${initial}</text>
</svg>
`;
}

function buildIndexHtml(
  system: DesignSystem,
  projectData: ProjectModel | undefined,
  language: string
): string {
  const title = projectTitle(projectData);

  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${title}</title>
    <meta name="theme-color" content="${system.colors.brand['600']}" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="icon" href="./icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="./icon.svg" />
${fontLinks(system)}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

export function buildMobileScaffold(
  system: DesignSystem,
  projectData: ProjectModel | undefined,
  language: string
): { files: Record<string, string>; locked: string[] } {
  const title = projectTitle(projectData);

  const locked: Record<string, string> = {
    'package.json': buildPackageJson({
      projectData,
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        'cap:sync': 'npm run build && cap sync',
      },
      dependencies: {
        '@capacitor/core': '^6.1.0',
        'react-router-dom': '^6.26.0',
      },
      devDependencies: { '@capacitor/cli': '^6.1.0' },
    }),
    'capacitor.config.json': `${JSON.stringify(
      { appId: appId(projectData), appName: title, webDir: 'dist' },
      null,
      2
    )}\n`,
    'vite.config.js': VITE_CONFIG_MOBILE,
    'postcss.config.js': POSTCSS_CONFIG,
    'tailwind.config.js': buildTailwindConfig(system, [
      './index.html',
      './src/**/*.{js,jsx,ts,tsx}',
    ]),
    'index.html': buildIndexHtml(system, projectData, language),
    'public/manifest.webmanifest': `${JSON.stringify(
      {
        name: title,
        short_name: title.slice(0, 12),
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: system.colors.surface,
        theme_color: system.colors.brand['600'],
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      null,
      2
    )}\n`,
    'public/icon.svg': buildIcon(system, projectData),
    'public/sw.js': SW,
    'src/styles/index.css': buildBaseCss(system, SAFE_AREA_CSS),
    'src/main.jsx': MAIN,
    'src/lib/cn.js': CN_HELPER,
    'src/lib/utils.js': CN_UTILS,
    'components.json': componentsJson('src/styles/index.css'),
    'jsconfig.json': JSCONFIG,
    'src/components/layout/AppShell.jsx': APP_SHELL,
    'src/components/layout/TopBar.jsx': TOP_BAR,
    'src/hooks/useStoredState.js': USE_STORED_STATE,
    ...buildUiKit(),
  };

  return {
    files: {
      ...locked,
      'src/tabs.js': TABS_PLACEHOLDER,
      'src/App.jsx': appPlaceholder(projectData, language),
    },
    locked: Object.keys(locked),
  };
}
