#!/usr/bin/env node
/**
 * Un paquet partagé utilisé par une application doit être copié dans l'image
 * de cette application. Sinon : `npm run build` passe sur la machine du
 * développeur, et l'image casse au déploiement — à l'installation des
 * dépendances si le paquet est une dépendance `file:`, à la compilation s'il
 * est consommé comme source, au démarrage s'il l'est par un lien symbolique.
 *
 * Ce contrôle compare, pour chaque application :
 *
 *  - les paquets `@idem/*` que ses sources importent réellement ;
 *  - ceux que son Dockerfile copie.
 *
 * Un Dockerfile qui prend tout `packages/` d'un coup est couvert par
 * construction. `npm run check:docker` ; aucun réseau, aucun démon Docker.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

/**
 * Les images à contrôler, et l'application que chacune construit.
 *
 * Une application peut avoir plusieurs images (développement, production,
 * pré-production) : elles doivent toutes copier les mêmes paquets.
 */
const IMAGES = [
  { dockerfile: 'Dockerfile/prod/Dockerfile.landing', app: 'apps/landing' },
  { dockerfile: 'Dockerfile/dev/Dockerfile.landing', app: 'apps/landing' },
  { dockerfile: 'Dockerfile/prod/Dockerfile.main-dashboard', app: 'apps/main-dashboard' },
  { dockerfile: 'Dockerfile/prod/Dockerfile.main-dashboard.staging', app: 'apps/main-dashboard' },
  { dockerfile: 'Dockerfile/dev/Dockerfile.main-dashboard', app: 'apps/main-dashboard' },
  { dockerfile: 'Dockerfile/prod/Dockerfile.simulation', app: 'apps/simulation' },
  { dockerfile: 'Dockerfile/prod/Dockerfile.ideploy-web', app: 'apps/ideploy-web' },
  { dockerfile: 'Dockerfile/dev/Dockerfile.ideploy-web', app: 'apps/ideploy-web' },
  { dockerfile: 'Dockerfile/prod/Dockerfile.ivision-web', app: 'apps/ivision/web' },
  {
    dockerfile: 'Dockerfile/prod/Dockerfile.appgen-client',
    app: 'apps/appgen/apps/we-dev-client',
  },
  { dockerfile: 'Dockerfile/dev/Dockerfile.appgen', app: 'apps/appgen' },
  { dockerfile: 'Dockerfile/prod/Dockerfile.chart', app: 'apps/chart' },
];

/**
 * Les applications sans image à elles. Le contrôle les signale : une
 * application qu'on ne sait pas déployer est un fait, pas un détail.
 */
const WITHOUT_IMAGE = ['apps/idomain/web', 'apps/idomain/api'];

/**
 * Les manques connus, et pourquoi ils ne sont pas comblés par un `COPY`.
 *
 * Une exception se justifie, elle ne se décrète pas : chaque entrée dit ce
 * qu'il faudrait décider pour la lever. Elles sont relevées, affichées à
 * chaque passage, et ne font pas échouer le contrôle.
 */
const KNOWN_GAPS = {
  'Dockerfile/prod/Dockerfile.chart': {
    packages: ['shared-auth-client', 'shared-models'],
    reason:
      "l'éditeur de diagrammes importe ces deux paquets dans ses sources mais ne les " +
      'déclare pas dans son package.json (seuls shared-loader et shared-styles y sont, ' +
      'en `file:`). Les copier ne suffirait donc pas : pnpm ne les lierait pas. À ' +
      'trancher — déclarer les dépendances, ou retirer les imports morts',
  },
};

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.html', '.css', '.json']);
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', '.angular', '.next', 'coverage', 'tmp']);

/** Les paquets qui existent vraiment, pour ne pas traquer un nom inventé. */
const PACKAGES = new Set(
  readdirSync(join(ROOT, 'packages')).filter((name) =>
    statSync(join(ROOT, 'packages', name)).isDirectory()
  )
);

let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`  KO  ${message}`);
}

function ok(message) {
  console.log(`  ok  ${message}`);
}

/** Les paquets `@idem/*` importés par les sources d'une application. */
function usedPackages(appDir) {
  const used = new Set();
  const root = join(ROOT, appDir);

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        // Les liens vers `packages/` (Angular 22) ne sont pas des sources de
        // l'application : les suivre reviendrait à lire le paquet lui-même.
        if (entry.isSymbolicLink?.()) continue;
        walk(path);
        continue;
      }
      const dot = entry.name.lastIndexOf('.');
      if (dot < 0 || !SOURCE_EXTENSIONS.has(entry.name.slice(dot))) continue;
      const text = readFileSync(path, 'utf8');
      // Seulement un nom entre guillemets : c'est ce qui distingue un import,
      // une correspondance de chemin ou un alias Vite d'une simple mention
      // dans un commentaire. Sans cette règle, « voir @idem/graphic-engine »
      // dans une phrase faisait échouer le contrôle.
      for (const match of text.matchAll(/['"`]@idem\/([a-z0-9-]+)/g)) {
        if (PACKAGES.has(match[1])) used.add(match[1]);
      }
    }
  };

  walk(root);
  return used;
}

/** Ce qu'une image copie : `null` quand elle prend tout `packages/`. */
function copiedPackages(dockerfile) {
  const text = readFileSync(join(ROOT, dockerfile), 'utf8');
  if (/^COPY\s+\.?\/?packages\s+\.?\/?packages\s*$/m.test(text)) return null;
  const copied = new Set();
  for (const match of text.matchAll(/^COPY\s+\.\/packages\/([a-z0-9-]+)/gm)) {
    copied.add(match[1]);
  }
  return copied;
}

console.log('Paquets partagés dans les images');
const usedCache = new Map();
for (const { dockerfile, app } of IMAGES) {
  if (!usedCache.has(app)) usedCache.set(app, usedPackages(app));
  const used = usedCache.get(app);
  const copied = copiedPackages(dockerfile);

  if (copied === null) {
    ok(`${dockerfile} — copie tout packages/`);
    continue;
  }

  const allowed = new Set(KNOWN_GAPS[dockerfile]?.packages ?? []);
  const missing = [...used].filter((name) => !copied.has(name) && !allowed.has(name)).sort();
  const tolerated = [...used].filter((name) => !copied.has(name) && allowed.has(name)).sort();

  if (tolerated.length > 0) {
    console.log(
      `  --  ${dockerfile} — manque connu : ${tolerated.map((n) => `@idem/${n}`).join(', ')} ` +
        `(${KNOWN_GAPS[dockerfile].reason})`
    );
  }

  if (missing.length === 0) {
    ok(`${dockerfile} — ${used.size} paquet(s) utilisé(s), tous copiés`);
    continue;
  }
  fail(
    `${dockerfile} ne copie pas ${missing.map((n) => `@idem/${n}`).join(', ')} — ` +
      `ajoutez « COPY ./packages/<nom> ./packages/<nom> » (utilisé par ${app})`
  );
}

console.log('Applications sans image');
for (const app of WITHOUT_IMAGE) {
  const used = [...usedPackages(app)].sort();
  console.log(
    `  --  ${app} n'a pas de Dockerfile` +
      (used.length > 0 ? ` (utilise ${used.map((n) => `@idem/${n}`).join(', ')})` : '')
  );
}

if (failures > 0) {
  console.error(`\n${failures} image(s) incomplète(s).`);
  process.exit(1);
}
console.log('\nToutes les images copient ce que leur application utilise.');
