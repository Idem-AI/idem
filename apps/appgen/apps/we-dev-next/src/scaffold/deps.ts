/**
 * Les dépendances du socle, connues d'avance — et donc installables d'avance.
 *
 * Le socle est déterministe : pour une cible donnée, les manifestes npm qu'il
 * écrit sont toujours les mêmes (seul le champ `name` suit le projet). L'arbre
 * `node_modules` qui en découle est donc lui aussi toujours le même.
 *
 * Or c'est le poste de dépense le plus lourd de l'ouverture d'un atelier :
 * mesuré sur la cible « site », 191 paquets, 8 466 fichiers, 100 Mo, presque
 * trois minutes — dans la WebContainer, c'est-à-dire un npm qui tourne dans un
 * onglet, sur la connexion de l'utilisateur. Pendant ce temps l'écran est vide.
 *
 * Ce module décrit ce qui est installable d'avance, et sous quelle empreinte :
 *
 * - `depsPlan(target)` liste les arbres npm de la cible (une application web
 *   complète en a trois : la racine, `backend/`, `frontend/`) ;
 * - l'empreinte est calculée sur les blocs `dependencies` / `devDependencies`
 *   eux-mêmes, donc toute modification d'une version dans le socle produit
 *   mécaniquement une nouvelle empreinte, et l'ancien instantané n'est plus
 *   servi. Pas de version à incrémenter à la main, pas de socle périmé monté
 *   par erreur.
 *
 * Ce qui est servi sous cette empreinte est fabriqué par `scripts/bake-deps`
 * (voir `routes/deps.ts`), et l'atelier ne lui fait confiance qu'après l'avoir
 * vérifié : à défaut, `npm install` repart comme avant.
 */

import { createHash } from 'node:crypto';
import { BuildTarget } from '../config/buildTarget.js';

export interface DepsTree {
  /**
   * Identifiant de l'arbre, qui sert aussi de nom de fichier servi. `root`
   * pour la racine, sinon le dossier (`backend`, `frontend`).
   */
  id: string;
  /** Dossier du manifeste dans l'espace de travail, '' pour la racine. */
  dir: string;
  /** Où monter l'instantané, relativement à la racine de l'espace de travail. */
  mountPoint: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface DepsPlan {
  target: BuildTarget;
  /** Empreinte des dépendances de la cible entière, tous arbres confondus. */
  fingerprint: string;
  trees: DepsTree[];
}

const sortKeys = (record: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

/** Empreinte stable d'un arbre : son dossier et ses dépendances, rien d'autre. */
export function treeFingerprint(tree: Pick<DepsTree, 'dir' | 'dependencies' | 'devDependencies'>): string {
  const payload = JSON.stringify({
    dir: tree.dir,
    dependencies: sortKeys(tree.dependencies),
    devDependencies: sortKeys(tree.devDependencies),
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/**
 * Les arbres npm d'une cible, lus dans les fichiers du socle.
 *
 * On relit les manifestes que le socle écrit plutôt que de redéclarer les
 * listes de dépendances ici : une liste recopiée finit toujours par diverger de
 * l'originale, et une empreinte qui mentirait sur le contenu réel ferait monter
 * un `node_modules` incomplet — la panne la plus difficile à lire qu'on puisse
 * offrir à l'utilisateur.
 *
 * Les fichiers sont passés en argument, et non reconstruits ici : `buildScaffold`
 * appelle cette fonction pour annoncer son plan, et s'appeler lui-même en
 * retour tournerait en rond.
 *
 * Aucune donnée de projet n'intervient : le nom du paquet change d'un projet à
 * l'autre, les dépendances non. Les dépendances fonctionnelles qu'un site peut
 * demander en plus (`date-fns`, `zod`…) ne sont pas dans le socle : elles
 * s'installent à la demande, une seule à la fois, ce qui est rapide.
 */
export function depsPlanFromFiles(target: BuildTarget, files: Record<string, string>): DepsPlan {
  const trees: DepsTree[] = [];

  for (const [path, content] of Object.entries(files)) {
    if (path !== 'package.json' && !path.endsWith('/package.json')) continue;

    let manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
      manifest = JSON.parse(content);
    } catch {
      continue;
    }

    const dependencies = manifest.dependencies ?? {};
    const devDependencies = manifest.devDependencies ?? {};
    // Un manifeste sans dépendance (la racine d'une application complète en a
    // une seule, `concurrently`) reste un arbre : `npm run dev` en a besoin.
    if (!Object.keys(dependencies).length && !Object.keys(devDependencies).length) continue;

    const dir = path === 'package.json' ? '' : path.slice(0, -'/package.json'.length);
    trees.push({
      id: dir === '' ? 'root' : dir.split('/').join('-'),
      dir,
      mountPoint: dir === '' ? 'node_modules' : `${dir}/node_modules`,
      dependencies,
      devDependencies,
    });
  }

  trees.sort((a, b) => a.id.localeCompare(b.id));

  const fingerprint = createHash('sha256')
    .update(trees.map((tree) => `${tree.id}:${treeFingerprint(tree)}`).join('|'))
    .digest('hex')
    .slice(0, 16);

  return { target, fingerprint, trees };
}

/** Le manifeste à installer pour fabriquer un arbre, écrit tel quel par le four. */
export function treeManifest(target: BuildTarget, tree: DepsTree): string {
  return `${JSON.stringify(
    {
      name: `idem-deps-${target}-${tree.id}`,
      private: true,
      version: '0.0.0',
      type: 'module',
      dependencies: sortKeys(tree.dependencies),
      devDependencies: sortKeys(tree.devDependencies),
    },
    null,
    2
  )}\n`;
}

/** Les cibles dont les dépendances sont préinstallées. */
export const BAKED_TARGETS: BuildTarget[] = ['site', 'web-app', 'mobile-app'];
