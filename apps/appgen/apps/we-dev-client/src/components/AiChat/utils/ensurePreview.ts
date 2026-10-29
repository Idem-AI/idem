import { getLastServerUrl } from '@/components/WeIde/services';
import useRunStatus from '@/stores/runStatusSlice';
import { queue } from '../useMessageParser';
import { startupBegin } from '@/utils/startupTimer';

/**
 * Garantit qu'un aperçu tourne après la génération.
 *
 * La chaîne normale — installer, démarrer — part de l'artefact du modèle, et la
 * file d'exécution saute toute commande déjà lancée à la même position. Deux
 * conséquences qu'on observe : un tour qui ne contient que du texte ne relance
 * rien, et une génération en plusieurs tours peut installer une dépendance
 * après le démarrage, sans redémarrer.
 *
 * Cette garde ne regarde pas les intentions mais le résultat : y a-t-il un
 * serveur ? Sinon, au bout d'un moment, elle relance. Une fois, et seulement si
 * rien n'est déjà en train de s'installer ou de démarrer.
 */

/**
 * Les traces d'une installation à moitié faite.
 *
 * Dans la WebContainer, deux npm concurrents ou une coupure réseau laissent un
 * `node_modules` incomplet : npm s'arrête sur « EIO », et la commande de
 * démarrage ne trouve plus son binaire. Relancer `npm install` par-dessus ne
 * répare rien — npm croit le travail fait. Il faut vider et recommencer.
 */
const BROKEN_INSTALL = [
  /EIO: failed to link packages/i,
  /command not found:\s*(next|vite|concurrently)/i,
  /Cannot find module .*(next|vite)/i,
  /ENOTEMPTY: directory not empty/i,
];

const POLL_MS = 1000;
/**
 * Laisser sa chance à la chaîne normale avant d'intervenir — courte : rien ne s'installe ni ne démarre, c'est
 * qu'aucune commande n'est partie. Trente secondes d'attente ici faisaient à elles seules rater l'objectif des 20 s.
 */
const GRACE_MS = 4000;
/** Next met plus longtemps que Vite à répondre la première fois. */
const GIVE_UP_MS = 180000;

let watching = false;
let repaired = false;

/** Réinitialise la réparation quand l'espace de travail repart à zéro. */
export const resetInstallRepair = (): void => {
  repaired = false;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function ensurePreviewRunning(startCommand = 'npm run dev'): Promise<void> {
  if (watching) return;
  watching = true;

  try {
    const started = Date.now();
    let forced = false;
    startupBegin('after-generation');

    while (Date.now() - started < GIVE_UP_MS) {
      if (getLastServerUrl()) return;

      const { phase, lines } = useRunStatus.getState();
      const busy = phase === 'installing' || phase === 'starting';

      // Une installation corrompue d'abord : la relancer telle quelle ne
      // changerait rien, npm la croit terminée.
      if (!repaired && !busy && lines.some((line) => BROKEN_INSTALL.some((p) => p.test(line)))) {
        console.warn('[aperçu] installation incomplète : nettoyage puis réinstallation');
        repaired = true;
        forced = true;
        queue.push('rm -rf node_modules package-lock.json');
        queue.push('npm install');
        queue.push(startCommand);
      } else if (!forced && !busy && Date.now() - started > GRACE_MS) {
        console.warn("[aperçu] aucun serveur après la génération : relance de l'installation");
        forced = true;
        queue.push('npm install');
        queue.push(startCommand);
      }

      await sleep(POLL_MS);
    }

    if (!getLastServerUrl()) {
      console.warn("[aperçu] toujours aucun serveur : voir le terminal");
    }
  } finally {
    watching = false;
  }
}
