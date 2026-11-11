/**
 * Mettre les dépendances en place — vite, et sans jamais mentir.
 *
 * Trois sources, dans cet ordre :
 *
 * 1. **le cache du navigateur** (IndexedDB). Rien à télécharger : l'arbre est
 *    déjà là, monté en quelques secondes. C'est le cas de toutes les ouvertures
 *    sauf la première ;
 * 2. **l'instantané du serveur**, 17 à 40 Mo compressés selon la cible, une
 *    seule requête, cacheable pour toujours. C'est la première ouverture ;
 * 3. **`npm install`**, comme avant, trois minutes. C'est le chemin de secours,
 *    et il doit rester praticable : un instantané absent, tronqué ou taillé
 *    pour un autre socle ne doit jamais casser une génération.
 *
 * ## Ce qui est vérifié avant de faire confiance
 *
 * Un `node_modules` monté qui n'est pas exactement celui qu'attend le manifeste
 * produit la panne la plus pénible du lot : Vite démarre, puis meurt sur un
 * module introuvable, et l'utilisateur voit un aperçu vide sans rien
 * comprendre. On vérifie donc, après le montage :
 *
 * - le marqueur `node_modules/.idem-deps.json` porte bien l'empreinte attendue
 *   (il est écrit par nous après un montage réussi, jamais par npm) ;
 * - les binaires dont le démarrage dépend sont là (`node_modules/.bin/vite`,
 *   ou `concurrently` pour une application complète) ;
 * - chaque dépendance directe du manifeste a son dossier.
 *
 * À la moindre absence, l'arbre est effacé, oublié du cache, et `npm install`
 * reprend. On perd le temps du téléchargement, jamais la génération.
 */

import {
  DepsPlanInfo,
  DepsTargetName,
  DepsTreeInfo,
  fetchDepsPlan,
  fetchSnapshot,
} from '@/api/deps';
import { getWebContainerInstance } from './instance';
import { readWorkspaceFile, repairExecBits, runCommand } from './runner';
import { syncFileSystem } from './filesystem';
import { useFileStore } from '../../stores/fileStore';
import { compress, decompress, forgetSnapshot, readSnapshot, writeSnapshot } from './depsStore';
import { timed } from '@/utils/startupTimer';

export type DepsSource = 'cache' | 'snapshot' | 'nearest' | 'npm' | 'already-there' | 'failed';

export interface DepsOutcome {
  tree: string;
  source: DepsSource;
  ms: number;
  /** Ce qui n'a pas marché, quand la source est retombée plus bas. */
  note?: string;
}

export interface DepsProgress {
  /** 'download' | 'mount' | 'verify' | 'npm' : ce qu'on est en train de faire. */
  step: 'plan' | 'download' | 'mount' | 'verify' | 'npm' | 'done';
  tree: string;
  /** Part du téléchargement, entre 0 et 1, quand elle a un sens. */
  ratio?: number;
  bytes?: number;
  totalBytes?: number;
}

const MARKER = '.idem-deps.json';

/** Les binaires sans lesquels la commande de démarrage ne peut pas partir. */
const REQUIRED_BINARIES: Record<string, string[]> = {
  root: ['vite', 'concurrently'],
  frontend: ['vite'],
  backend: [],
};

let planPromise: Promise<DepsPlanInfo | null> | null = null;
let planTarget: DepsTargetName | null = null;

/**
 * Demande le plan dès que la cible est connue — c'est-à-dire avant le projet,
 * avant le socle, dès la première image. Le plan ne dépend que de la cible.
 */
export function prefetchDepsPlan(target: DepsTargetName): Promise<DepsPlanInfo | null> {
  if (planPromise && planTarget === target) return planPromise;
  planTarget = target;
  planPromise = fetchDepsPlan(target);
  return planPromise;
}

/** Oublie le plan : la cible a changé (lien sans `product`, choix web/mobile). */
export function resetDepsPlan(): void {
  planPromise = null;
  planTarget = null;
  satisfied.clear();
  inflight.clear();
  cachedReads.clear();
}

/**
 * Les téléchargements en cours ou terminés, par arbre.
 *
 * Le gros du temps d'une première ouverture, sur une connexion africaine, est
 * le transfert de l'arbre — 17 Mo pour un site, davantage pour une application
 * complète. Il ne dépend ni du projet ni du conteneur : il peut donc partir dès
 * la première image, en même temps que les requêtes du projet, au lieu
 * d'attendre que le socle soit monté.
 *
 * Cette table est ce qui rend les deux chemins compatibles : le préchargement
 * démarre la promesse, `ensureTree` attend la même. Rien n'est téléchargé deux
 * fois, et rien n'est attendu deux fois.
 */
const inflight = new Map<string, Promise<Uint8Array | null>>();

const inflightKey = (target: string, tree: DepsTreeInfo) =>
  `${target}/${tree.id}/${tree.fingerprint}`;

/** Le téléchargement d'un arbre, lancé une seule fois. */
function snapshotOnce(
  target: DepsTargetName,
  tree: DepsTreeInfo,
  onProgress?: (progress: DepsProgress) => void
): Promise<Uint8Array | null> {
  const key = inflightKey(target, tree);
  const known = inflight.get(key);
  if (known) return known;

  const task = fetchSnapshot(tree, ({ received, total }) => {
    onProgress?.({
      step: 'download',
      tree: tree.id,
      ratio: total ? Math.min(1, received / total) : undefined,
      bytes: received,
      totalBytes: total,
    });
  });

  inflight.set(key, task);
  return task;
}

/**
 * L'arbre gardé dans le navigateur, lu et décompressé une seule fois : le préchauffage le lance dès la première image
 * (la cible est connue), `ensureTree` attend la même promesse. Les deux postes — lire 30 Mo dans IndexedDB, en
 * décompresser 100 — se font ainsi pendant le chargement du projet, plus après.
 */
const cachedReads = new Map<string, Promise<Uint8Array | null>>();

function cachedOnce(target: DepsTargetName, tree: DepsTreeInfo): Promise<Uint8Array | null> {
  const key = inflightKey(target, tree);
  const known = cachedReads.get(key);
  if (known) return known;
  const task = (async () => {
    const stored = await readSnapshot(target, tree.id, tree.fingerprint);
    return stored ? decompress(stored) : null;
  })().catch(() => null);
  cachedReads.set(key, task);
  return task;
}

/**
 * Précharge les arbres d'une cible, avant que le conteneur ou le socle existent.
 *
 * Appelé seulement quand la cible est **certaine** — c'est-à-dire quand
 * l'adresse porte `product` et `platform`. Sans eux, la cible vient de la
 * configuration du projet, donc d'une requête : deviner coûterait 17 Mo de
 * transfert pour rien, ce qui est exactement ce qu'on refuse de faire payer sur
 * une connexion lente. Dans ce cas on ne précharge que le plan.
 */
export async function prefetchDepsSnapshots(
  target: DepsTargetName,
  onProgress?: (progress: DepsProgress) => void
): Promise<void> {
  const plan = await prefetchDepsPlan(target);
  if (!plan) return;

  for (const tree of plan.trees) {
    if (await cachedOnce(target, tree)) continue;
    if (!tree.baked || !tree.url) continue;

    // En série : deux transferts de 17 Mo en parallèle sur une connexion lente
    // se partagent la bande passante et arrivent tous les deux en retard.
    await snapshotOnce(target, tree, onProgress);
  }
}

/**
 * Au-delà, une installation npm est considérée bloquée : arrêtée, et l'aperçu dit qu'il n'a pas démarré. Un arbre
 * complet sans instantané prend 6 à 9 minutes dans la WebContainer (mesuré) ; une installation bloquée, elle,
 * tournait sans fin.
 */
const NPM_TIMEOUT_MS = 15 * 60_000;

/** Arbres déjà en place dans ce conteneur, pour ne pas y revenir. */
const satisfied = new Set<string>();

/** À appeler quand le conteneur est remplacé : son disque est vide. */
export function resetDeps(): void {
  satisfied.clear();
  // Une mise en place partie dans l'ancien conteneur n'a plus de sens, et elle peut ne jamais finir (ses processus
  // meurent avec lui sans rendre la main) : gardée ici, chaque démarrage suivant de la cible l'attendait — l'aperçu
  // « démarrait » indéfiniment jusqu'au rechargement de la page.
  ensuring.clear();
}

/**
 * Met les dépendances d'une cible en place. Résout quand le projet peut
 * démarrer — ou quand on a épuisé les recours, ce que dit le résultat.
 */
export function ensureDependencies(target: DepsTargetName, onProgress?: (progress: DepsProgress) => void): Promise<DepsOutcome[]> {
  // Une seule mise en place à la fois par cible : le démarrage à chaud et un `npm install` écrit par le modèle se
  // rejoignent au lieu de monter deux fois le même arbre.
  const known = ensuring.get(target);
  if (known) return known;
  const task = ensureDependenciesNow(target, onProgress).finally(() => ensuring.delete(target));
  ensuring.set(target, task);
  return task;
}

const ensuring = new Map<DepsTargetName, Promise<DepsOutcome[]>>();

async function ensureDependenciesNow(
  target: DepsTargetName,
  onProgress?: (progress: DepsProgress) => void
): Promise<DepsOutcome[]> {
  const plan = await prefetchDepsPlan(target);
  await timed('deps.boot', () => getWebContainerInstance());

  // Les manifestes doivent être sur le disque du conteneur avant tout : sans
  // eux, `npm install` n'a rien à installer et la vérification d'un arbre monté
  // ne peut pas comparer ce qu'elle voit à ce qui est attendu.
  //
  // Ce n'est pas acquis : `setFiles` écrit dans le magasin et appelle une
  // synchronisation **débouncée** (500 ms, lodash). Son `await` rend la main
  // tout de suite, bien avant que les fichiers soient montés. Le démarrage à
  // chaud, lui, part aussitôt — c'est tout son intérêt — et arrivait donc avant
  // le socle.
  await timed('deps.manifests', () => waitForManifests(plan?.trees ?? [{ dir: '' }]));
  await dropStaleLockfiles(plan?.trees ?? [{ dir: '' }]);

  if (!plan) {
    // Pas de plan : on ne sait pas quels arbres existent. `npm install` à la
    // racine est le comportement d'avant, et il reste juste pour un site ou
    // une application mobile. Une application complète a son `postinstall`
    // (voir le socle) qui installe `frontend/` et `backend/`.
    onProgress?.({ step: 'npm', tree: 'root' });
    const started = performance.now();
    const result = await runCommand('npm install');
    return [
      {
        tree: 'root',
        source: result.exitCode === 0 ? 'npm' : 'failed',
        ms: Math.round(performance.now() - started),
        note: 'plan de dépendances indisponible',
      },
    ];
  }

  // En série et non en parallèle : deux npm concurrents dans la même
  // WebContainer se marchent dessus (« EIO: failed to link packages »), et deux
  // montages en parallèle se disputent la mémoire du conteneur sur des arbres
  // de 100 Mo. L'ordre met la racine en dernier : `frontend/` est ce qui fait
  // apparaître l'aperçu.
  const ordered = [...plan.trees].sort((a, b) => (a.id === 'root' ? 1 : b.id === 'root' ? -1 : 0));

  const outcomes: DepsOutcome[] = [];
  for (const tree of ordered) {
    outcomes.push(await ensureTree(target, tree, onProgress));
  }

  onProgress?.({ step: 'done', tree: 'all' });
  return outcomes;
}

async function ensureTree(
  target: DepsTargetName,
  tree: DepsTreeInfo,
  onProgress?: (progress: DepsProgress) => void
): Promise<DepsOutcome> {
  const started = performance.now();
  const since = () => Math.round(performance.now() - started);
  const key = `${tree.id}/${tree.fingerprint}`;

  if (satisfied.has(key)) return { tree: tree.id, source: 'already-there', ms: 0 };

  // Un arbre déjà bon dans le conteneur : rechargement de page, retour sur le
  // projet, ou installation faite par un tour précédent.
  const present = await treeState(tree);
  if (present === 'ok') {
    satisfied.add(key);
    return { tree: tree.id, source: 'already-there', ms: since() };
  }
  // Un bon arbre auquel le manifeste ajoute quelques paquets : npm ne télécharge que la différence, rien n'est
  // effacé (avant, l'arbre entier repartait pour trois minutes d'installation).
  if (present === 'missing-deps' && (await topUp(tree, onProgress))) {
    satisfied.add(key);
    rememberInstalled(target, tree);
    return { tree: tree.id, source: 'npm', ms: since(), note: 'arbre en place complété' };
  }

  // 1. Le cache du navigateur, déjà lu et décompressé par le préchauffage le plus souvent (attente presque nulle).
  const bytes = await timed('deps.cache', () => cachedOnce(target, tree));
  cachedReads.delete(inflightKey(target, tree));
  if (bytes) {
    onProgress?.({ step: 'mount', tree: tree.id });
    if (await mountTree(tree, bytes)) {
      onProgress?.({ step: 'verify', tree: tree.id });
      const state = await timed('deps.verify', () => treeState(tree));
      if (state === 'ok' || (state === 'missing-deps' && (await topUp(tree, onProgress)))) {
        satisfied.add(key);
        keepPrebundle(target, tree);
        return { tree: tree.id, source: 'cache', ms: since() };
      }
      // Un arbre gardé qui ne passe pas la vérification est inutilisable :
      // on le jette, sinon il serait relu à chaque ouverture.
      await forgetSnapshot(target, tree.id, tree.fingerprint);
      await wipeTree(tree);
    }
  }

  // 2. L'instantané du serveur.
  if (tree.baked && tree.url) {
    onProgress?.({ step: 'download', tree: tree.id, ratio: 0, bytes: 0, totalBytes: tree.bytes });

    // Le transfert a peut-être déjà été lancé par le préchargement, avant même
    // que le conteneur existe : on attend la même promesse, on n'en démarre pas
    // une seconde.
    const bytes = await timed('deps.download', () => snapshotOnce(target, tree, onProgress));

    if (bytes?.length) {
      onProgress?.({ step: 'mount', tree: tree.id });
      if (await mountTree(tree, bytes)) {
        onProgress?.({ step: 'verify', tree: tree.id });
        const state = await timed('deps.verify', () => treeState(tree));
        if (state === 'ok' || (state === 'missing-deps' && (await topUp(tree, onProgress)))) {
          satisfied.add(key);
          // Gardé pour la prochaine ouverture — après le montage, pour ne pas
          // retarder le démarrage par une écriture de 20 Mo.
          void (async () => {
            const packed = await compress(bytes);
            await writeSnapshot({
              target,
              tree: tree.id,
              fingerprint: tree.fingerprint,
              bytes: packed.bytes,
              compressed: packed.compressed,
            });
          })();
          inflight.delete(inflightKey(target, tree));
          keepPrebundle(target, tree);
          return { tree: tree.id, source: 'snapshot', ms: since() };
        }
        await wipeTree(tree);
      }
    }
  }

  // 3. Pas encore cuit sous cette empreinte (une version de paquet vient de changer) : l'arbre voisin le plus
  //    récent, monté puis complété par npm — la différence au lieu de tout.
  if (!tree.baked && tree.nearest?.url) {
    onProgress?.({ step: 'download', tree: tree.id, ratio: 0, bytes: 0, totalBytes: tree.nearest.bytes });
    const near: DepsTreeInfo = { ...tree, fingerprint: tree.nearest.fingerprint, url: tree.nearest.url, bytes: tree.nearest.bytes, baked: true };
    const bytes = await timed('deps.download', () => snapshotOnce(target, near, onProgress));
    if (bytes?.length && (await mountTree(near, bytes)) && (await topUp(tree, onProgress))) {
      satisfied.add(key);
      rememberInstalled(target, tree);
      return { tree: tree.id, source: 'nearest', ms: since(), note: `voisin ${tree.nearest.fingerprint} complété` };
    }
    await wipeTree(tree);
  }

  // 4. npm, comme avant.
  onProgress?.({ step: 'npm', tree: tree.id });
  const note = tree.baked ? 'instantané inutilisable' : 'pas encore préinstallé';
  const result = await timed('deps.npm', () => runCommand('npm install', { cwd: tree.dir || undefined, timeoutMs: NPM_TIMEOUT_MS }));

  // Une installation qui n'a pas abouti dans le délai ne fera pas mieux au second essai (réseau, registre) : on le
  // dit tout de suite au lieu de doubler l'attente.
  if (result.timedOut) return { tree: tree.id, source: 'failed', ms: since(), note: 'npm install trop long' };

  if (result.exitCode !== 0) {
    // Une installation à moitié faite ne se répare pas par une seconde
    // tentative : npm croit le travail fait. On vide et on recommence une fois.
    await wipeTree(tree);
    const retry = await runCommand('npm install', { cwd: tree.dir || undefined, timeoutMs: NPM_TIMEOUT_MS });
    if (retry.exitCode !== 0) {
      return { tree: tree.id, source: 'failed', ms: since(), note };
    }
  }

  await writeMarker(tree, 'npm');
  satisfied.add(key);
  rememberInstalled(target, tree);
  return { tree: tree.id, source: 'npm', ms: since(), note };
}

/**
 * npm complète un arbre déjà en place (paquets ajoutés au manifeste, arbre voisin) : il ne télécharge que la
 * différence. Vrai si l'arbre est ensuite complet ; le marqueur prend alors l'empreinte attendue.
 */
async function topUp(tree: DepsTreeInfo, onProgress?: (progress: DepsProgress) => void): Promise<boolean> {
  onProgress?.({ step: 'npm', tree: tree.id });
  const result = await timed('deps.npm', () =>
    runCommand('npm install --no-audit --no-fund --prefer-offline', { cwd: tree.dir || undefined, timeoutMs: NPM_TIMEOUT_MS })
  );
  if (result.exitCode !== 0) return false;
  await writeMarker(tree, 'top-up');
  return (await treeState(tree)) === 'ok';
}

/**
 * Une installation passée par npm (complète ou complétée) est gardée dans le cache du navigateur sous
 * l'empreinte de l'arbre : la prochaine ouverture la monte en quelques secondes. Faite après coup, une fois
 * l'aperçu lancé : exporter un arbre de 100 Mo ne doit rien retarder.
 *
 * Un arbre qui porte Vite est gardé APRÈS son pré-regroupement (`node_modules/.vite/deps/_metadata.json`) : la
 * prochaine ouverture trouve alors les dépendances déjà regroupées, et Vite sert la première page sans les refaire
 * (le dossier de travail est fixe, voir `instance.ts` ; le site n'écrit pas de `package-lock.json`, voir son
 * `.npmrc` — les deux entrent dans la signature du cache de Vite).
 */
const remembering = new Set<string>();

function rememberInstalled(target: DepsTargetName, tree: DepsTreeInfo): void {
  const key = inflightKey(target, tree);
  if (remembering.has(key)) return;
  remembering.add(key);
  void (async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 15_000));
      if (await hasVite(tree)) await waitForPrebundle(tree);
      const container = await getWebContainerInstance();
      if (!container) return;
      const exported = (await container.export(tree.mountPoint, { format: 'binary' })) as Uint8Array;
      const packed = await compress(exported);
      await writeSnapshot({ target, tree: tree.id, fingerprint: tree.fingerprint, bytes: packed.bytes, compressed: packed.compressed });
      console.log(`[deps] ${tree.id} gardé dans le cache du navigateur${(await hasPrebundle(tree)) ? ', dépendances pré-regroupées comprises' : ''}`);
    } catch (error) {
      console.warn(`[deps] ${tree.id} : mise en cache impossible`, error);
    } finally {
      remembering.delete(key);
    }
  })();
}

/**
 * Un arbre monté sans pré-regroupement (instantané du four, ancien cache) est regardé une fois Vite passé : s'il a
 * regroupé, l'arbre est regardé de nouveau, et l'ouverture suivante en profite.
 */
const upgraded = new Set<string>();

function keepPrebundle(target: DepsTargetName, tree: DepsTreeInfo): void {
  const key = inflightKey(target, tree);
  if (upgraded.has(key)) return;
  upgraded.add(key);
  void (async () => {
    if ((await hasVite(tree)) && !(await hasPrebundle(tree))) rememberInstalled(target, tree);
  })();
}

const PREBUNDLE_WAIT_MS = 180_000;

async function hasVite(tree: DepsTreeInfo): Promise<boolean> {
  return (await readWorkspaceFile(`${tree.mountPoint}/vite/package.json`)) !== null;
}

async function hasPrebundle(tree: DepsTreeInfo): Promise<boolean> {
  return (await readWorkspaceFile(`${tree.mountPoint}/.vite/deps/_metadata.json`)) !== null;
}

/** Attend que Vite ait fini de regrouper (le fichier de métadonnées est écrit en dernier). */
async function waitForPrebundle(tree: DepsTreeInfo): Promise<void> {
  const deadline = Date.now() + PREBUNDLE_WAIT_MS;
  while (Date.now() < deadline) {
    if (await hasPrebundle(tree)) return;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

/** Monte l'instantané. L'arbre est posé tel quel, sans passer par npm. */
async function mountTree(tree: DepsTreeInfo, snapshot: Uint8Array): Promise<boolean> {
  const container = await getWebContainerInstance();
  if (!container) return false;

  try {
    if (tree.dir) await container.fs.mkdir(tree.dir, { recursive: true });
    await container.fs.mkdir(tree.mountPoint, { recursive: true });
  } catch {
    // Le dossier existe déjà : c'est exactement ce qu'on voulait.
  }

  try {
    // `mount` transfère le tampon : on en donne une copie, l'appelant garde
    // le sien pour l'écrire dans le cache.
    const transferable = snapshot.slice();
    await timed('deps.mount', () => container.mount(transferable, { mountPoint: tree.mountPoint }));
    await timed('deps.exec', () => restoreExecBits(tree));
    await writeMarker(tree, 'snapshot');
    return true;
  } catch (error) {
    console.warn(`[deps] montage de ${tree.id} impossible`, error);
    return false;
  }
}

/**
 * Un arbre exporté puis remonté (cache du navigateur, instantané du serveur, arbre voisin) garde ses liens, mais pas
 * le mode de leurs cibles : `vite/bin/vite.js` revenait en 644 et `npm run dev` mourait sur « spawn vite EACCES ».
 * Rétabli à chaque montage (voir `repairExecBits`).
 */
async function restoreExecBits(tree: DepsTreeInfo): Promise<void> {
  await repairExecBits([tree.mountPoint]);
}

async function writeMarker(tree: DepsTreeInfo, source: string): Promise<void> {
  const container = await getWebContainerInstance();
  if (!container) return;
  try {
    await container.fs.writeFile(
      `${tree.mountPoint}/${MARKER}`,
      `${JSON.stringify({ fingerprint: tree.fingerprint, source, at: new Date().toISOString() })}\n`
    );
  } catch {
    // Sans marqueur, la vérification suivante repartira d'un `npm install` :
    // plus lent, jamais faux.
  }
}

/**
 * L'arbre en place est-il celui qu'on attend ?
 *
 * Volontairement concret : on ne lit pas un état mémorisé, on regarde le disque
 * du conteneur. Un rechargement de page, un conteneur recréé, une installation
 * interrompue — tous laissent l'état mémoire et le disque en désaccord.
 */
async function verifyTree(tree: DepsTreeInfo): Promise<boolean> {
  return (await treeState(tree)) === 'ok';
}

/**
 * L'état de l'arbre sur le disque : `ok` ; `missing-deps` (le bon arbre, mais le manifeste demande des paquets
 * absents : npm complète sans rien effacer) ; `bad` (pas d'arbre, autre socle, binaire de démarrage absent).
 */
async function treeState(tree: DepsTreeInfo): Promise<'ok' | 'missing-deps' | 'bad'> {
  const container = await getWebContainerInstance();
  if (!container) return 'bad';

  // 1. Le marqueur, qui dit pour quel socle cet arbre a été posé (un arbre voisin monté porte l'empreinte voisine
  //    jusqu'à ce que npm l'ait complété).
  let fingerprint: string | undefined;
  try {
    const raw = await container.fs.readFile(`${tree.mountPoint}/${MARKER}`, 'utf-8');
    fingerprint = (JSON.parse(raw) as { fingerprint?: string }).fingerprint;
    if (fingerprint !== tree.fingerprint && fingerprint !== tree.nearest?.fingerprint) return 'bad';
  } catch {
    return 'bad';
  }

  // 2. Les binaires dont dépend la commande de démarrage. « Au moins un » et
  //    non « tous » : la racine d'une application complète n'a que
  //    `concurrently`, un site n'a que `vite`.
  const binaries = REQUIRED_BINARIES[tree.id] ?? [];
  if (binaries.length) {
    const found = await Promise.all(
      binaries.map(async (binary) => {
        try {
          await container.fs.readFile(`${tree.mountPoint}/.bin/${binary}`, 'utf-8');
          return true;
        } catch {
          return false;
        }
      })
    );
    // Le binaire manque mais l'arbre est là : npm le recrée en complétant.
    if (!found.some(Boolean)) return 'missing-deps';
  }

  // 3. Chaque dépendance directe a son dossier. C'est ce qui attrape un arbre
  //    tronqué — un téléchargement coupé, un quota IndexedDB atteint en cours
  //    d'écriture — que le marqueur seul ne verrait pas.
  const manifest = await readManifest(tree);
  if (manifest) {
    const names = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ];
    for (const name of names) {
      try {
        await container.fs.readdir(`${tree.mountPoint}/${name}`);
      } catch {
        console.warn(`[deps] ${tree.id} : ${name} manque dans l'arbre monté`);
        return 'missing-deps';
      }
    }
  }

  // Un arbre voisin complet garde ses anciennes versions tant que npm ne l'a pas aligné sur le manifeste.
  return fingerprint === tree.fingerprint ? 'ok' : 'missing-deps';
}

async function readManifest(
  tree: DepsTreeInfo
): Promise<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null> {
  const container = await getWebContainerInstance();
  if (!container) return null;
  const path = tree.dir ? `${tree.dir}/package.json` : 'package.json';
  try {
    return JSON.parse(await container.fs.readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

/** Combien de temps on attend que le socle atteigne le disque du conteneur. */
const MANIFEST_WAIT_MS = 20_000;
const MANIFEST_POLL_MS = 150;

/**
 * Attend que les `package.json` des arbres soient lisibles dans le conteneur.
 *
 * La synchronisation en attente est d'abord forcée (`flush`), ce qui suffit
 * presque toujours ; le sondage couvre le reste — une synchronisation déjà
 * partie, dont on ne tient pas la promesse.
 */
async function waitForManifests(trees: Array<Pick<DepsTreeInfo, 'dir'>>): Promise<void> {
  try {
    await (syncFileSystem as unknown as { flush: () => Promise<unknown> }).flush();
  } catch {
    // Rien en attente, ou synchronisation déjà faite : le sondage tranchera.
  }

  const paths = trees.map((tree) => (tree.dir ? `${tree.dir}/package.json` : 'package.json'));
  const deadline = Date.now() + MANIFEST_WAIT_MS;

  while (Date.now() < deadline) {
    const found = await Promise.all(paths.map((path) => readWorkspaceFile(path)));
    if (found.every(Boolean)) return;
    await new Promise((resolve) => setTimeout(resolve, MANIFEST_POLL_MS));
  }

  console.warn('[deps] socle absent du conteneur après 20 s : on tente quand même');
}

/**
 * Un projet qui déclare `package-lock=false` (le site, voir son `.npmrc`) mais garde un `package-lock.json` d'une
 * ancienne session : retiré avant le démarrage de Vite, sinon la signature de son cache de dépendances ne
 * correspond plus à celle de l'instantané et tout le pré-regroupement est refait.
 */
async function dropStaleLockfiles(trees: Array<Pick<DepsTreeInfo, 'dir'>>): Promise<void> {
  for (const tree of trees) {
    const at = (path: string) => (tree.dir ? `${tree.dir}/${path}` : path);
    const npmrc = await readWorkspaceFile(at('.npmrc'));
    if (!npmrc || !/^\s*package-lock\s*=\s*false\s*$/m.test(npmrc)) continue;
    if ((await readWorkspaceFile(at('package-lock.json'))) === null) continue;
    try {
      if (useFileStore.getState().files[at('package-lock.json')] !== undefined) await useFileStore.getState().deleteFile(at('package-lock.json'));
      const container = await getWebContainerInstance();
      await container?.fs.rm(at('package-lock.json'), { force: true });
    } catch {
      // Gardé : Vite refera son regroupement, rien de plus.
    }
  }
}

/** Efface l'arbre : c'est la seule façon de repartir d'un npm propre. */
async function wipeTree(tree: DepsTreeInfo): Promise<void> {
  await runCommand(`rm -rf ${tree.mountPoint} ${tree.dir ? `${tree.dir}/package-lock.json` : 'package-lock.json'}`, {
    quiet: true,
  });
}
