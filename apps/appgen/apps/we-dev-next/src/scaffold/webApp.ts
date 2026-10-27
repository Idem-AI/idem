/**
 * Starter « application web complète » : `frontend/` (Vite + React + Tailwind)
 * et `backend/` (Express + PostgreSQL, PGlite dans l'aperçu), démarrés par une
 * seule commande à la racine.
 *
 * Le contrat qui faisait le plus de dégâts quand le modèle l'écrivait — le
 * `concurrently` de la racine, la bascule PGlite / `pg`, le proxy `/api` de
 * Vite, le client HTTP — est posé ici. Le modèle écrit le schéma, les données
 * de départ, les routes et les écrans.
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

const ROOT_PACKAGE = (name: string): string => `${JSON.stringify(
  {
    name,
    private: true,
    version: '0.0.0',
    scripts: {
      postinstall: 'cd backend && npm install && cd ../frontend && npm install',
      dev: 'concurrently -k -n api,web -c blue,green "cd backend && npm run dev" "cd frontend && npm run dev"',
      build: 'cd frontend && npm run build',
    },
    devDependencies: { concurrently: '^9.0.0' },
  },
  null,
  2
)}\n`;

const BACKEND_PACKAGE = `${JSON.stringify(
  {
    name: 'backend',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'node --watch src/index.js', start: 'node src/index.js' },
    dependencies: {
      '@electric-sql/pglite': '^0.2.0',
      bcryptjs: '^2.4.3',
      cors: '^2.8.5',
      express: '^4.19.0',
      jsonwebtoken: '^9.0.2',
      pg: '^8.12.0',
      zod: '^3.23.8',
    },
  },
  null,
  2
)}\n`;

/** Le seul fichier qui sait quel moteur tourne. */
const DB = `import { existsSync, readFileSync } from 'node:fs';

let run;
let exec;

if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  run = async (text, params = []) => (await pool.query(text, params)).rows;
  exec = (sql) => pool.query(sql);
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite('./.pglite');
  run = async (text, params = []) => (await db.query(text, params)).rows;
  exec = (sql) => db.exec(sql);
}

const readSql = (name) => {
  const url = new URL(\`./\${name}\`, import.meta.url);
  return existsSync(url) ? readFileSync(url, 'utf8').trim() : '';
};

/** Crée les tables et les données de départ ; ne fait rien si elles existent. */
export async function initDatabase() {
  for (const name of ['schema.sql', 'seed.sql']) {
    const sql = readSql(name);
    if (!sql) {
      console.warn(\`[db] \${name} absent ou vide\`);
      continue;
    }
    await exec(sql);
  }
}

/** Toujours en requête paramétrée (\`$1\`, \`$2\`), jamais par concaténation. */
export const query = run;
`;

/**
 * Serveur : santé, erreurs, et montage automatique des routeurs.
 *
 * Chaque fichier de `src/routes/` exporte par défaut un `express.Router()` et
 * est monté sous `/api`. Le modèle ajoute un fichier, pas une ligne de montage.
 */
const SERVER = `import { readdir } from 'node:fs/promises';
import cors from 'cors';
import express from 'express';
import { initDatabase } from './db.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Montage automatique : un fichier dans src/routes/ = un routeur sous /api.
const routesDir = new URL('./routes/', import.meta.url);

try {
  const entries = await readdir(routesDir);
  for (const file of entries.filter((name) => name.endsWith('.js')).sort()) {
    const module = await import(new URL(file, routesDir).href);
    if (module.default) {
      app.use('/api', module.default);
      console.log(\`[api] routes/\${file} monté\`);
    }
  }
} catch (error) {
  console.warn('[api] aucune route montée :', error.message);
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT) || 3001;
await initDatabase();
app.listen(port, () => console.log(\`API à l'écoute sur http://localhost:\${port}\`));
`;

/** Authentification : signature et vérification des jetons, prêtes à l'emploi. */
const AUTH = `import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);
export const signToken = (payload) => jwt.sign(payload, SECRET, { expiresIn: '7d' });

/** Middleware : refuse la requête sans jeton valable, sinon remplit req.user. */
export function requireUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
`;

const FRONTEND_VITE = `import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // '@' → src/ : convention des composants shadcn/ui et des registres.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Les .js de src/ sont lus comme du JSX : une balise dans un fichier de
  // données ne doit pas faire tomber l'application entière.
  esbuild: {
    loader: 'jsx',
    include: new RegExp('src/.*[.][jt]sx?$'),
    // Vite exclut les .js de cette transformation par défaut : sans ce
    // tableau vide, l'option ci-dessus ne s'applique à rien.
    exclude: [],
  },
  // React pré-regroupé dès le démarrage (pas de « nouvelle dépendance, rechargement » à la première page), et
  // les fichiers d'entrée transformés avant la première requête.
  optimizeDeps: {
    include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client'],
    esbuildOptions: { loader: { '.js': 'jsx' } },
  },
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
    warmup: { clientFiles: ['./src/main.jsx', './src/App.jsx'] },
  },
});
`;

const API_CLIENT = `const BASE = import.meta.env.VITE_API_URL ?? '';

/** Tout appel au backend passe par ici. Le jeton, s'il existe, est joint. */
export async function api(path, options = {}) {
  const token = localStorage.getItem('token');

  const response = await fetch(\`\${BASE}/api\${path}\`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error ?? \`HTTP \${response.status}\`);
  }

  return data;
}
`;

const MAIN = `import { createRoot } from 'react-dom/client';
// Sans extension : le produit peut être écrit en .jsx comme en .tsx.
import App from './App';
import './styles/index.css';

createRoot(document.getElementById('root')).render(<App />);
`;

/**
 * La page d'attente.
 *
 * L'aperçu démarre maintenant avant la fin de la génération (voir
 * `warmStart.ts` côté atelier) : cette page est donc ce que l'utilisateur voit
 * d'abord, pas un bouche-trou technique. Elle montre la forme du tableau de
 * bord à venir, dans les couleurs du projet, et le premier fichier écrit par le
 * modèle la remplace par rechargement à chaud.
 */
const appPlaceholder = (projectData: ProjectModel | undefined, language: string): string =>
  `/* idem:placeholder — remplacé par la première génération */
export default function App() {
  return (
${awaitingBody({ target: 'web-app', projectData, language })}
  );
}
`;

const SCHEMA_PLACEHOLDER = `-- Schéma de la base. Rejoué à chaque démarrage : tout en CREATE TABLE IF NOT EXISTS.
`;

const SEED_PLACEHOLDER = `-- Données de départ. Identifiants explicites + ON CONFLICT (id) DO NOTHING.
`;

function buildIndexHtml(
  system: DesignSystem,
  projectData: ProjectModel | undefined,
  language: string
): string {
  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${projectTitle(projectData)}</title>
    <meta name="theme-color" content="${system.colors.brand['600']}" />
${fontLinks(system)}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

const README = (title: string): string => `# ${title}

Application web complète : \`backend/\` (Express + PostgreSQL) et \`frontend/\`
(Vite + React). \`npm install\` puis \`npm run dev\` à la racine démarrent les deux.

## Variables d'environnement

- Backend : \`DATABASE_URL\` (sans elle, PGlite en mémoire pour l'aperçu), \`PORT\`
  (3001), \`JWT_SECRET\`, \`CORS_ORIGIN\`.
- Frontend : \`VITE_API_URL\` (vide en local, le proxy Vite relaie \`/api\`).
`;

/** Préfixe `frontend/` sur les chemins de la trousse commune. */
const underFrontend = (files: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(files).map(([path, content]) => [`frontend/${path}`, content]));

export function buildWebAppScaffold(
  system: DesignSystem,
  projectData: ProjectModel | undefined,
  language: string
): { files: Record<string, string>; locked: string[] } {
  const locked: Record<string, string> = {
    'package.json': ROOT_PACKAGE(packageName(projectData)),
    'README.md': README(projectTitle(projectData)),
    'backend/package.json': BACKEND_PACKAGE,
    'backend/src/db.js': DB,
    'backend/src/index.js': SERVER,
    'backend/src/auth.js': AUTH,
    'frontend/package.json': buildPackageJson({
      projectData,
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { 'react-router-dom': '^6.26.0' },
    }).replace(`"name": "${packageName(projectData)}"`, '"name": "frontend"'),
    'frontend/vite.config.js': FRONTEND_VITE,
    'frontend/postcss.config.js': POSTCSS_CONFIG,
    'frontend/tailwind.config.js': buildTailwindConfig(system, [
      './index.html',
      './src/**/*.{js,jsx,ts,tsx}',
    ]),
    'frontend/index.html': buildIndexHtml(system, projectData, language),
    'frontend/src/styles/index.css': buildBaseCss(system),
    'frontend/src/main.jsx': MAIN,
    'frontend/src/api.js': API_CLIENT,
    'frontend/src/lib/cn.js': CN_HELPER,
    'frontend/src/lib/utils.js': CN_UTILS,
    'frontend/components.json': componentsJson('src/styles/index.css'),
    'frontend/jsconfig.json': JSCONFIG,
    ...underFrontend(buildUiKit()),
  };

  return {
    files: {
      ...locked,
      'backend/src/schema.sql': SCHEMA_PLACEHOLDER,
      'backend/src/seed.sql': SEED_PLACEHOLDER,
      'frontend/src/App.jsx': appPlaceholder(projectData, language),
    },
    locked: Object.keys(locked),
  };
}
