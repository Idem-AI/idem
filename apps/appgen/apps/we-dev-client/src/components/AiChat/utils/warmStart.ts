/**
 * Le démarrage à chaud : l'aperçu avant la première phrase du modèle.
 *
 * ## Ce que c'était
 *
 * L'ouverture d'un atelier enchaînait, en série : chargement du projet,
 * demande du socle, montage, apparition du terminal (jusqu'à vingt secondes de
 * sondage), `npm install` (presque trois minutes, mesurées sur la cible
 * « site » : 191 paquets, 100 Mo), génération, *puis* `npm run dev` et le
 * démarrage à froid de Vite. L'aperçu arrivait à la fin de tout. Jusque-là
 * l'utilisateur regardait un écran de chargement, et c'est ce qu'il retenait de
 * l'atelier.
 *
 * ## Ce que c'est
 *
 * Le socle est un projet complet qui démarre tout seul : il a son `index.html`,
 * son point d'entrée, sa charte, et un écran d'attente à la marque du projet.
 * Il n'y a donc aucune raison d'attendre le modèle pour le lancer.
 *
 *  préchauffage (dès la première image) ───────────────────────────────┐
 *  conteneur démarré, plan des dépendances demandé                      │
 *                                                                       │
 *  socle monté ──► dépendances en place ──► `npm run dev` ──► APERÇU ◄──┘
 *                  (cache : 2 s. instantané : 10 s. npm : 3 min)
 *                                     ║
 *  génération ════════════════════════╬══════════════════════════════►
 *                  chaque fichier écrit arrive par HMR dans l'aperçu
 *
 * L'utilisateur voit son application se construire écran par écran au lieu
 * d'attendre devant un rond qui tourne. Le temps total ne change pas beaucoup ;
 * le temps *ressenti* passe de « long » à « tout de suite ».
 *
 * ## Ce qui est garanti
 *
 * - le serveur part une fois, et seulement si rien ne tourne déjà ;
 * - une installation faite à la main ou par le modèle n'est pas doublée (voir
 *   `runCommand`, qui dédoublonne les commandes en vol) ;
 * - si les dépendances n'ont pas pu être mises en place, on ne lance pas le
 *   serveur : `ensurePreviewRunning`, en fin de génération, s'en occupe avec
 *   son propre filet (nettoyage puis réinstallation).
 */

import { getContainerInstance, getLastServerUrl } from '@/components/WeIde/services';
import {
  DepsOutcome,
  DepsProgress,
  ensureDependencies,
  prefetchDepsPlan,
  prefetchDepsSnapshots,
  resetDeps,
} from '@/components/WeIde/services/webcontainer/deps';
import { resetRunner, startCommand, stopStarted } from '@/components/WeIde/services/webcontainer/runner';
import type { DepsTargetName } from '@/api/deps';
import useWarmStart from '@/stores/warmStartSlice';
import { currentPlatform, currentProduct } from '@/utils/product';
import { startupBegin, startupPhase, startupReset, startupSource } from '@/utils/startupTimer';

/**
 * La cible, telle que la connaît l'atelier avant d'avoir chargé le projet.
 *
 * `null` quand l'adresse ne la dit pas : elle vient alors de la configuration
 * du projet, donc d'une requête. On ne devine pas — un mauvais pari coûterait
 * un transfert de 17 Mo pour rien, et c'est précisément ce qu'on refuse de
 * faire payer sur une connexion lente.
 */
export function targetFromChoice(
  product?: string | null,
  platform?: string | null
): DepsTargetName | null {
  if (product === 'site') return 'site';
  if (product === 'app') return platform === 'mobile' ? 'mobile-app' : 'web-app';
  return null;
}

let warmed = false;

/**
 * Préchauffage, appelé dès le premier rendu.
 *
 * Le démarrage du conteneur (une à trois secondes : service worker, mémoire
 * partagée) et la demande du plan de dépendances ne dépendent ni du projet ni
 * du socle. Les faire maintenant, c'est les faire pendant que les requêtes du
 * projet voyagent — donc gratuitement.
 */
export function prewarmWorkspace(target: DepsTargetName | null): void {
  if (warmed) return;
  warmed = true;

  void getContainerInstance().then((container) => {
    if (container) console.log('[chaud] conteneur prêt');
  });

  // Sans cible certaine, on s'arrête là : le conteneur démarre, et le plan
  // suivra le socle.
  if (!target) return;

  void (async () => {
    const plan = await prefetchDepsPlan(target);
    if (!plan) return;

    const baked = plan.trees.filter((tree) => tree.baked).length;
    console.log(`[chaud] plan ${plan.target} : ${baked}/${plan.trees.length} arbre(s) préinstallé(s)`);
    if (!baked) return;

    // Et le transfert part tout de suite, en même temps que le chargement du
    // projet : c'est le poste le plus long d'une première ouverture, et il ne
    // dépend ni du projet ni du conteneur. La progression s'affiche dès
    // maintenant sous l'aperçu, pour que 17 Mo sur une connexion lente
    // ressemblent à une attente et non à un blocage.
    useWarmStart.getState().begin(target);
    await prefetchDepsSnapshots(target, (progress) => useWarmStart.getState().progress(progress));
  })();
}

/** Le préchauffage repart à zéro quand le conteneur est remplacé. */
export function resetWarmStart(): void {
  clearTimeout(startWatch);
  useWarmStart.getState().reset();
  startupReset();
  warmed = false;
  started = false;
  resetDeps();
  resetRunner();
}

let started = false;

/** La dernière cible et les dernières commandes, pour une relance manuelle. */
let lastTarget: DepsTargetName | null = null;
let lastCommands: { install: string; start: string } | null = null;

/**
 * Met les dépendances en place puis lance le serveur de développement, pendant
 * que le modèle écrit.
 *
 * `startCommand` et non `runCommand` : un serveur de développement ne rend
 * jamais la main. L'état « prêt » se lit sur `server-ready`, que l'aperçu
 * écoute déjà.
 */
export async function warmStart(
  target: DepsTargetName,
  commands: { install: string; start: string }
): Promise<void> {
  if (started) return;
  started = true;
  lastTarget = target;
  lastCommands = commands;

  useWarmStart.getState().begin(target);
  startupBegin('warm-start', target);

  const onProgress = (progress: DepsProgress) => useWarmStart.getState().progress(progress);

  let outcomes: DepsOutcome[] = [];
  const depsStarted = performance.now();
  try {
    outcomes = await ensureDependencies(target, onProgress);
    startupPhase('dependencies', performance.now() - depsStarted);
    outcomes.forEach((outcome) => startupSource(outcome.source));
  } catch (error) {
    console.warn('[chaud] dépendances non mises en place', error);
    useWarmStart.getState().fail('deps');
    started = false;
    return;
  }

  const failed = outcomes.filter((outcome) => outcome.source === 'failed');
  for (const outcome of outcomes) {
    console.log(
      `[chaud] ${outcome.tree} : ${outcome.source} en ${(outcome.ms / 1000).toFixed(1)} s` +
        (outcome.note ? ` (${outcome.note})` : '')
    );
  }

  if (failed.length) {
    // On ne lance pas un serveur sur un arbre incomplet : il mourrait sur un
    // module introuvable, et l'erreur remonterait comme une erreur du projet
    // alors que c'est une erreur d'installation. La fin de génération reprend.
    useWarmStart.getState().fail('deps');
    started = false;
    return;
  }

  // Un serveur déjà ouvert (rechargement, projet rouvert) : rien à relancer, et
  // surtout rien à annoncer comme « en train de démarrer » — l'aperçu répond
  // déjà.
  if (getLastServerUrl()) {
    useWarmStart.getState().markReady();
    return;
  }

  useWarmStart.getState().serverStarting();
  await startCommand(commands.start);
  watchServerStart();
}

/** Un serveur de développement lancé qui ne répond toujours pas après ce délai ne répondra plus. */
const SERVER_START_TIMEOUT_MS = 120_000;
let startWatch: ReturnType<typeof setTimeout> | undefined;

/**
 * Le démarrage a une fin. Sans elle, un serveur mort en silence (ou jamais vraiment lancé) laissait l'aperçu sur
 * « Démarrage en cours… » indéfiniment, sans erreur ni bouton utile : l'aperçu passe en échec, dit de quoi il
 * s'agit et propose « Exécuter ».
 */
function watchServerStart(): void {
  clearTimeout(startWatch);
  startWatch = setTimeout(() => {
    if (getLastServerUrl() || useWarmStart.getState().step !== 'starting') return;
    console.warn('[chaud] aucun serveur après', SERVER_START_TIMEOUT_MS / 1000, 's');
    started = false;
    useWarmStart.getState().fail('server');
  }, SERVER_START_TIMEOUT_MS);
}

/**
 * La cible des dépendances de cet atelier : celle du dernier démarrage à chaud (le socle l'a dite), sinon celle
 * de l'adresse. `null` : inconnue — on ne devine pas (voir `targetFromChoice`).
 */
export function depsTarget(): DepsTargetName | null {
  return lastTarget ?? targetFromChoice(currentProduct(), currentPlatform());
}

/**
 * Un nouveau démarrage à chaud pour une autre cible ou un socle remplacé (refonte, `/site`) : les dépendances déjà
 * sur le disque sont gardées et vérifiées, rien n'est effacé. L'appelant arrête l'ancien serveur s'il servait une
 * autre cible.
 */
export async function rewarm(target: DepsTargetName, commands: { install: string; start: string }): Promise<void> {
  started = false;
  await warmStart(target, commands);
}

/** Le serveur a-t-il déjà été lancé à chaud ? */
export const warmStartLaunched = (): boolean => started;

/**
 * Relance demandée par l'utilisateur (« Exécuter » sous l'aperçu).
 *
 * Même chemin que le démarrage à chaud, simplement réarmé : les dépendances
 * sont vérifiées sur le disque du conteneur, reprises du cache ou de
 * l'instantané si elles manquent, et npm n'est appelé qu'en dernier recours.
 * Un aperçu déjà vivant n'est pas touché — ce bouton sert à rattraper une
 * chaîne qui n'a rien donné, pas à redémarrer ce qui tourne.
 */
export async function startProject(): Promise<void> {
  started = false;
  // Un serveur lancé qui n'a jamais répondu bloquerait la relance (une commande vivante n'est pas lancée deux fois).
  if (!getLastServerUrl()) stopStarted();
  const target = lastTarget ?? targetFromChoice(currentProduct(), currentPlatform()) ?? 'site';
  await warmStart(target, lastCommands ?? { install: 'npm install', start: 'npm run dev' });
}
