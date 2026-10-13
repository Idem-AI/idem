/**
 * Portail de compilation : ce qui sort du modèle doit démarrer.
 *
 * Le socle garantit la configuration, pas le produit. Or un modèle — surtout un
 * petit — rate toujours les mêmes choses, et chacune tue l'aperçu entier :
 *
 * 1. il importe un fichier qu'il n'a pas écrit (réponse tronquée, oubli) →
 *    « Failed to resolve import », page morte ;
 * 2. il importe un paquet qui n'est pas installé → même mort ;
 * 3. il importe une icône qui n'existe pas dans `lucide-react` → l'import passe,
 *    la valeur vaut `undefined`, React jette « Element type is invalid » ;
 * 4. il écrit `@apply font-figtree` — une classe déduite du nom de la police —
 *    et PostCSS arrête tout ;
 * 5. il écrit `src/App.tsx` alors que le socle a posé `src/App.jsx` : Vite
 *    résout `.jsx` avant `.tsx`, et c'est le fichier d'attente qui s'affiche ;
 * 6. un fichier importé par défaut n'exporte rien par défaut → écran blanc.
 *
 * Tout cela est détectable sans modèle, donc gratuitement, et réparable par du
 * code. Ce module est volontairement *pur* : il prend la carte des fichiers,
 * rend des écritures, des suppressions et des commandes. Le branchement sur
 * l'atelier vit ailleurs, et les règles se testent sans navigateur.
 *
 * Principe de réparation : on ne devine jamais l'intention. On rend le projet
 * exécutable, on signale ce qui a été bouché, et la passe qualité (ou
 * l'utilisateur) comble ensuite. Une page à qui il manque une section vaut
 * infiniment mieux qu'un écran d'erreur à qui il manque tout.
 */

/** Paquets que l'on accepte d'installer quand le modèle les importe. */
const INSTALLABLE = new Set([
  '@headlessui/react',
  '@heroicons/react',
  '@hookform/resolvers',
  'clsx',
  'date-fns',
  'embla-carousel-react',
  'framer-motion',
  'motion',
  'react-countup',
  'react-hook-form',
  'react-icons',
  'react-intersection-observer',
  'react-router-dom',
  'recharts',
  'swiper',
  'tailwind-merge',
  'zod',
  'zustand',
]);

/** Utilitaires `font-*` réellement fournis par Tailwind, au-delà des familles. */
const FONT_UTILITIES = new Set([
  'thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold',
  'extrabold', 'black', 'sans', 'serif', 'mono', 'display',
]);

const CODE = /\.(jsx?|tsx?|mjs|cjs)$/i;

/**
 * Modules fournis par Node. Ils n'ont rien à faire dans l'analyse : ils ne
 * s'installent pas, et une doublure posée à leur place casserait le fichier de
 * configuration qui les utilise légitimement.
 */
const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http', 'https',
  'module', 'os', 'path', 'process', 'stream', 'url', 'util', 'zlib',
]);

const isNodeBuiltin = (pkg: string): boolean =>
  pkg.startsWith('node:') || NODE_BUILTINS.has(pkg);

/**
 * Le code du produit, et lui seul.
 *
 * Les fichiers de configuration à la racine (`vite.config.js`, `postcss…`) sont
 * posés par le socle et importent des modules Node : les analyser ne peut rien
 * apporter et risque de les réparer de travers.
 */
const isProductCode = (path: string): boolean =>
  path.startsWith('src/') || path.startsWith('frontend/src/');
const STYLE = /\.css$/i;

/** Extensions tentées pour un import relatif, dans l'ordre de Vite. */
const RESOLVE_ORDER = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'];

export type IssueKind =
  | 'missing-module'
  | 'missing-package'
  | 'unknown-package'
  | 'unknown-icon-guard'
  | 'bad-apply'
  | 'stale-placeholder'
  | 'wrong-extension'
  | 'missing-default-export';

export interface Issue {
  kind: IssueKind;
  /** Fichier concerné (celui qui importe, ou celui qui a été réparé). */
  file: string;
  detail: string;
}

export interface GateResult {
  /** Fichiers à écrire ou réécrire dans l'espace de travail. */
  writes: Record<string, string>;
  /** Fichiers à retirer (doublons d'entrée du socle). */
  deletes: string[];
  /** Commandes à exécuter avant le démarrage. */
  installs: string[];
  issues: Issue[];
}

interface ImportRef {
  /** Spécificateur tel qu'écrit. */
  source: string;
  /** Le fichier importe-t-il un export par défaut ? */
  hasDefault: boolean;
}

/** Dossiers de projet possibles : racine (site, mobile) et `frontend/`. */
const rootsOf = (files: Record<string, string>): string[] => {
  const roots = new Set<string>();
  for (const path of Object.keys(files)) {
    if (path.startsWith('frontend/')) roots.add('frontend/');
    else if (path.startsWith('backend/')) roots.add('backend/');
    else roots.add('');
  }
  return Array.from(roots);
};

const dirOf = (path: string): string => {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
};

/** Résout `../a/b` par rapport au dossier du fichier, sans segments relatifs. */
function joinPath(dir: string, relative: string): string {
  const segments = (dir ? dir.split('/') : []).concat(relative.split('/'));
  const out: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }

  return out.join('/');
}

/**
 * Relit les imports d'un fichier.
 *
 * Expression régulière plutôt qu'un vrai analyseur : il faut lire du code que
 * le modèle vient d'écrire, parfois tronqué, et un analyseur strict refuserait
 * le fichier entier là où l'on veut justement en extraire ce qui est lisible.
 */
export function readImports(code: string): ImportRef[] {
  const refs: ImportRef[] = [];
  const seen = new Set<string>();

  const push = (source: string, clause: string) => {
    if (!source) return;
    // Un même module importé deux fois : la présence d'un défaut suffit.
    const hasDefault = /^\s*(?!\{)(?!\*)[A-Za-z_$][\w$]*\s*(,|from|$)/.test(clause);
    const key = `${source}|${hasDefault}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({ source, hasDefault });
  };

  // import X, { y } from 'z' · import 'z' · export { y } from 'z'
  const statement = /(?:^|\n)\s*(?:import|export)\s+([\s\S]*?)?\s*from\s*['"]([^'"]+)['"]/g;
  for (const match of Array.from(code.matchAll(statement))) push(match[2], match[1] ?? '');

  const bare = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
  for (const match of Array.from(code.matchAll(bare))) push(match[1], '');

  const dynamic = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of Array.from(code.matchAll(dynamic))) push(match[1], '');

  return refs;
}

/** Nom de paquet d'un spécificateur (`@scope/pkg/sub` → `@scope/pkg`). */
export function packageNameOf(source: string): string {
  const parts = source.split('/');
  return source.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Les dépendances déclarées dans les manifestes présents. */
function declaredPackages(files: Record<string, string>): Set<string> {
  const declared = new Set<string>();

  for (const [path, content] of Object.entries(files)) {
    if (!/(^|\/)package\.json$/.test(path)) continue;
    try {
      const manifest = JSON.parse(content);
      for (const field of ['dependencies', 'devDependencies'] as const) {
        for (const name of Object.keys(manifest?.[field] ?? {})) declared.add(name);
      }
    } catch {
      // Manifeste illisible : `ensureRunnable` s'en occupe, pas ici.
    }
  }

  return declared;
}

/** Un import relatif pointe-t-il sur un fichier existant ? */
function resolveLocal(files: Record<string, string>, from: string, source: string): string | null {
  const base = joinPath(dirOf(from), source);
  if (!base) return null;

  if (files[base] !== undefined) return base;

  for (const extension of RESOLVE_ORDER) {
    if (files[`${base}${extension}`] !== undefined) return `${base}${extension}`;
  }
  for (const extension of RESOLVE_ORDER) {
    if (files[`${base}/index${extension}`] !== undefined) return `${base}/index${extension}`;
  }

  return null;
}

/**
 * Le même module sous une autre extension.
 *
 * `import App from './App.jsx'` alors que le modèle a écrit `App.tsx` : le
 * fichier visé n'existe pas, mais son jumeau oui. Boucher avec un fichier vide
 * serait le pire des résultats — la page s'afficherait, vide, sans erreur. On
 * réécrit donc l'import vers la forme sans extension, que Vite résout.
 */
function findTwin(
  files: Record<string, string>,
  from: string,
  source: string
): { path: string; specifier: string } | null {
  const match = source.match(/^(.*)\.(jsx?|tsx?|mjs|cjs)$/);
  if (!match) return null;

  const stem = match[1];
  const base = joinPath(dirOf(from), stem);

  for (const extension of RESOLVE_ORDER) {
    if (files[`${base}${extension}`] !== undefined) {
      return { path: `${base}${extension}`, specifier: stem };
    }
  }

  return null;
}

/** Composant d'attente : invisible, et il n'empêche pas la page de s'afficher. */
const placeholderModule = (name: string): string => `/**
 * Fichier créé par IDEM : « ${name} » était importé sans avoir été écrit.
 *
 * Le composant ne rend rien, pour que le reste de la page s'affiche au lieu de
 * tomber sur « Failed to resolve import ». Demandez-le dans la conversation
 * pour qu'il soit écrit pour de bon.
 */
export default function ${name}() {
  return null;
}
`;

/** Nom de composant tiré d'un chemin (`sections/Hero.jsx` → `Hero`). */
function componentNameOf(path: string): string {
  const base = path.split('/').pop() ?? 'Placeholder';
  const stem = base.replace(CODE, '').replace(/[^A-Za-z0-9]/g, ' ');
  const name = stem
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');
  return /^[A-Za-z]/.test(name) ? name : `Placeholder${name}`;
}

/**
 * Doublure pour un paquet inconnu (inventé, ou hors liste blanche).
 *
 * Un `Proxy` répond à n'importe quel import nommé comme à n'importe quelle
 * propriété (`motion.div`), en rendant un composant neutre qui transmet ses
 * enfants. Le visuel est dégradé — un `div` à la place d'une animation — mais la
 * page existe, ce qui est tout l'objet du portail.
 */
const shimModule = (pkg: string): string => `/**
 * Doublure créée par IDEM pour « ${pkg} », importé mais absent du projet.
 * Elle rend la page exécutable ; installez le paquet pour le vrai comportement.
 */
import { createElement, forwardRef } from 'react';

const Neutral = forwardRef(function Neutral({ children, ...props }, ref) {
  // Les propriétés propres aux bibliothèques d'animation n'ont rien à faire
  // dans le DOM : elles déclencheraient des avertissements React en cascade.
  const safe = {};
  for (const key of Object.keys(props)) {
    if (/^(initial|animate|exit|transition|variants|while|drag|layout)/.test(key)) continue;
    safe[key] = props[key];
  }
  return createElement('div', { ...safe, ref }, children);
});

const handler = {
  get: (target, key) => {
    if (key === '__esModule') return true;
    if (key === 'default') return proxy;
    if (!(key in target)) target[key] = Neutral;
    return target[key];
  },
};

const proxy = new Proxy(Neutral, handler);

// Un seul export par défaut, volontairement : Rollup résout les exports NOMMÉS
// au moment de la construction, donc \`import { X } from './doublure'\` échouerait.
// Les imports du modèle sont réécrits en import par défaut + déstructuration,
// qui passe par l'accesseur du Proxy et répond à n'importe quel nom.
export default proxy;
`;

/**
 * Garde d'icônes : réexporte `lucide-react` en remplaçant par un repli toute
 * icône dont le nom n'existe pas.
 *
 * C'est la panne la plus sournoise du lot : l'import réussit, le composant vaut
 * `undefined`, et React s'arrête sur « Element type is invalid » — un écran
 * rouge pour un nom d'icône approximatif.
 */
const ICON_GUARD = `/**
 * Fichier créé par IDEM : accès sûr aux icônes Lucide.
 *
 * \`import { Sparkle } from '../_idem/icons.js'\` rend l'icône quand elle
 * existe, et un cercle discret sinon — jamais un écran d'erreur.
 */
import { createElement, forwardRef } from 'react';
import * as lucide from 'lucide-react';

const Fallback = forwardRef(function Fallback({ size = 24, ...props }, ref) {
  return createElement(
    'svg',
    {
      ...props,
      ref,
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      'aria-hidden': 'true',
    },
    createElement('circle', { cx: 12, cy: 12, r: 9 })
  );
});

const cache = new Map();

const icons = new Proxy(
  {},
  {
    get: (_target, name) => {
      if (typeof name !== 'string') return undefined;
      if (cache.has(name)) return cache.get(name);

      const candidate = lucide[name];
      const icon = typeof candidate === 'function' || typeof candidate === 'object' ? candidate : null;

      if (!icon) {
        console.warn('[idem] icône Lucide inconnue : ' + name);
      }

      const resolved = icon || Fallback;
      cache.set(name, resolved);
      return resolved;
    },
  }
);

// Export par défaut seulement : voir la doublure ci-dessus pour la raison.
export default icons;
`;

/** Retire d'un `@apply` les classes de police qui n'existent pas. */
export function fixApplyFontClasses(css: string): { css: string; removed: string[] } {
  const removed: string[] = [];

  const fixed = css.replace(/@apply([^;{}]*);/g, (whole, body: string) => {
    const kept: string[] = [];

    for (const token of body.trim().split(/\s+/).filter(Boolean)) {
      const font = token.match(/^(?:[a-z-]+:)*font-([A-Za-z0-9-]+)$/);
      if (font && !FONT_UTILITIES.has(font[1])) {
        removed.push(token);
        continue;
      }
      kept.push(token);
    }

    if (!removed.length) return whole;
    return kept.length ? `@apply ${kept.join(' ')};` : '';
  });

  return { css: fixed, removed };
}

/** Un fichier de composant exporte-t-il quelque chose par défaut ? */
const hasDefaultExport = (code: string): boolean =>
  /\bexport\s+default\b/.test(code) || /\bexport\s*\{[^}]*\bdefault\b/.test(code);

/**
 * Analyse l'espace de travail et rend tout ce qu'il faut pour qu'il démarre.
 */
export function planStabilization(files: Record<string, string>): GateResult {
  const writes: Record<string, string> = {};
  const deletes: string[] = [];
  const installs: string[] = [];
  const issues: Issue[] = [];

  const declared = declaredPackages(files);
  const roots = rootsOf(files);
  const current = { ...files };

  // --- 1. Doublons d'entrée : `App.tsx` du modèle contre `App.jsx` du socle.
  // Vite résout `.jsx` AVANT `.tsx`, donc sans cela c'est le fichier d'attente
  // du socle qui s'affiche, et l'utilisateur voit « Espace de travail prêt ».
  for (const root of roots) {
    if (root === 'backend/') continue;

    for (const stem of ['src/App', 'src/main']) {
      const jsx = `${root}${stem}.jsx`;
      const alternatives = [`${root}${stem}.tsx`, `${root}${stem}.ts`, `${root}${stem}.js`];
      const written = alternatives.find((path) => current[path] !== undefined);

      if (written && current[jsx] !== undefined) {
        deletes.push(jsx);
        delete current[jsx];
        issues.push({
          kind: 'stale-placeholder',
          file: jsx,
          detail: `retiré : ${written} le remplace`,
        });
      }
    }
  }

  // --- 2. Imports : fichiers manquants, paquets manquants, icônes.
  const iconGuardPath = (root: string) => `${root}src/_idem/icons.jsx`;
  const guardsNeeded = new Set<string>();
  const shims = new Map<string, string>();

  for (const [path, content] of Object.entries(current)) {
    if (!CODE.test(path) || typeof content !== 'string') continue;
    if (!isProductCode(path) || path.includes('/_idem/')) continue;

    const root = path.startsWith('frontend/') ? 'frontend/' : '';
    let patched = content;

    for (const { source, hasDefault } of readImports(content)) {
      // a. Import relatif
      if (source.startsWith('.')) {
        if (resolveLocal(current, path, source)) continue;

        // Le jumeau du fichier existe sous une autre extension : on réécrit.
        const twin = findTwin(current, path, source);
        if (twin) {
          patched = rewriteModuleImports(patched, source, twin.specifier);
          issues.push({
            kind: 'wrong-extension',
            file: path,
            detail: `${source} → ${twin.specifier} (${twin.path} existe)`,
          });
          continue;
        }

        // Le fichier manque : on le crée là où il était attendu.
        const base = joinPath(dirOf(path), source);
        const target = CODE.test(base) ? base : `${base}.jsx`;
        const name = componentNameOf(target);

        writes[target] = placeholderModule(name);
        current[target] = writes[target];
        issues.push({
          kind: 'missing-module',
          file: path,
          detail: `${source} n'existait pas → ${target} créé (ne rend rien)`,
        });
        continue;
      }

      // b. Paquet
      const pkg = packageNameOf(source);
      if (!pkg || pkg.startsWith('.') || isNodeBuiltin(pkg)) continue;

      // Les icônes passent par la garde, même quand le paquet est installé :
      // c'est le NOM de l'icône qui manque, pas le paquet.
      if (pkg === 'lucide-react') {
        const guard = iconGuardPath(root);
        if (path !== guard) {
          guardsNeeded.add(root);
          patched = rewriteThroughDefault(
            patched,
            'lucide-react',
            relativeImport(path, guard),
            '__idem_icons'
          );
        }
        continue;
      }

      if (declared.has(pkg)) continue;

      if (INSTALLABLE.has(pkg)) {
        const command = root === 'frontend/' ? `cd frontend && npm install ${pkg}` : `npm install ${pkg}`;
        if (!installs.includes(command)) {
          installs.push(command);
          issues.push({ kind: 'missing-package', file: path, detail: `${pkg} installé` });
        }
        continue;
      }

      // Paquet inconnu : doublure locale plutôt qu'un aperçu mort.
      const shimPath = `${root}src/_idem/shims/${pkg.replace(/[@/]/g, '-')}.jsx`;
      shims.set(shimPath, pkg);
      patched = rewriteThroughDefault(
        patched,
        source,
        relativeImport(path, shimPath),
        `__idem_${pkg.replace(/[^A-Za-z0-9]/g, '_')}`
      );
      issues.push({
        kind: 'unknown-package',
        file: path,
        detail: `${pkg} n'existe pas dans le projet → doublure neutre`,
      });
    }

    if (patched !== content) {
      writes[path] = patched;
      current[path] = patched;
    }
  }

  for (const root of Array.from(guardsNeeded)) {
    const guard = iconGuardPath(root);
    writes[guard] = ICON_GUARD;
    current[guard] = ICON_GUARD;
    issues.push({ kind: 'unknown-icon-guard', file: guard, detail: 'icônes Lucide sécurisées' });
  }

  for (const [shimPath, pkg] of Array.from(shims)) {
    writes[shimPath] = shimModule(pkg);
    current[shimPath] = writes[shimPath];
  }

  // --- 3. Export par défaut absent dans un fichier importé par défaut.
  for (const [path, content] of Object.entries(current)) {
    if (!CODE.test(path) || typeof content !== 'string') continue;
    if (!isProductCode(path) || path.includes('/_idem/')) continue;

    for (const { source, hasDefault } of readImports(content)) {
      if (!hasDefault || !source.startsWith('.')) continue;

      const resolved = resolveLocal(current, path, source);
      if (!resolved || resolved.endsWith('.json')) continue;

      const target = current[resolved];
      if (typeof target !== 'string' || hasDefaultExport(target)) continue;

      const name = componentNameOf(resolved);
      const appended = `${target.replace(/\s*$/, '')}\n\n// Ajouté par IDEM : ce fichier était importé par défaut sans rien exporter par défaut.\nexport default function ${name}() {\n  return null;\n}\n`;

      writes[resolved] = appended;
      current[resolved] = appended;
      issues.push({
        kind: 'missing-default-export',
        file: resolved,
        detail: `importé par défaut depuis ${path} → export par défaut ajouté`,
      });
    }
  }

  // --- 4. `@apply` d'une classe de police qui n'existe pas.
  for (const [path, content] of Object.entries(current)) {
    if (!STYLE.test(path) || typeof content !== 'string') continue;

    const { css, removed } = fixApplyFontClasses(content);
    if (!removed.length) continue;

    writes[path] = css;
    current[path] = css;
    issues.push({
      kind: 'bad-apply',
      file: path,
      detail: `classes retirées d'@apply : ${removed.join(', ')}`,
    });
  }

  // Un chemin supprimé ne doit jamais être réécrit : ce serait rétablir le
  // fichier d'attente du socle par-dessus le travail du modèle.
  for (const path of deletes) delete writes[path];

  return { writes, deletes, installs, issues };
}

/** Chemin d'import relatif de `from` vers `to`, extension conservée. */
export function relativeImport(from: string, to: string): string {
  const fromParts = dirOf(from).split('/').filter(Boolean);
  const toParts = to.split('/').filter(Boolean);

  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common += 1;
  }

  const up = fromParts.length - common;
  const prefix = up > 0 ? '../'.repeat(up) : './';
  return `${prefix}${toParts.slice(common).join('/')}`;
}

/** Réécrit les imports d'un module vers un autre chemin. */
function rewriteModuleImports(code: string, source: string, replacement: string): string {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return code.replace(new RegExp(`(['"])${escaped}\\1`, 'g'), `'${replacement}'`);
}

/**
 * Fait passer un module par un fichier local à export par défaut unique.
 *
 * `import { Home, Zap } from 'lucide-react'` devient
 * `import __idem_lucide from './_idem/icons.jsx'; const { Home, Zap } = __idem_lucide;`
 *
 * La déstructuration passe par l'accesseur du Proxy : un nom inconnu reçoit donc
 * le repli au lieu de `undefined`. Et surtout, plus aucun export nommé n'est
 * demandé au module — ce que Rollup refuserait à la construction, même quand le
 * serveur de développement l'accepte.
 */
export function rewriteThroughDefault(
  code: string,
  source: string,
  targetPath: string,
  binding: string
): string {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // La clause est limitée aux caractères qu'une liste d'imports peut contenir :
  // ni guillemet, ni point-virgule. Un `[\s\S]*?` paresseux, lui, traversait les
  // instructions précédentes et les faisait disparaître avec la réécriture.
  const statement = new RegExp(
    `(?:^|\\n)[ \\t]*import\\s+([A-Za-z0-9_$,{}\\s*:]+?)\\s*from\\s*['"]${escaped}['"]\\s*;?`,
    'g'
  );

  return code.replace(statement, (whole, clause: string) => {
    const named = clause.match(/\{([\s\S]*?)\}/);
    const namespace = clause.match(/\*\s*as\s+([A-Za-z_$][\w$]*)/);
    // `import X, { y } from …` : le défaut est ce qui précède la virgule.
    const fallback = clause.replace(/\{[\s\S]*?\}/, '').replace(/\*\s*as\s+[A-Za-z_$][\w$]*/, '');
    const defaultName = fallback.split(',').map((part) => part.trim()).find(Boolean);

    const lines: string[] = [`\nimport ${binding} from '${targetPath}';`];

    if (defaultName && /^[A-Za-z_$][\w$]*$/.test(defaultName)) {
      lines.push(`const ${defaultName} = ${binding};`);
    }

    if (namespace) {
      lines.push(`const ${namespace[1]} = ${binding};`);
    }

    if (named) {
      const bindings = named[1]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.replace(/\s+as\s+/, ': '))
        .join(', ');
      if (bindings) lines.push(`const { ${bindings} } = ${binding};`);
    }

    return lines.join('\n');
  });
}
