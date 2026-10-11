import useTerminalStore from '@/stores/terminalSlice';
import { queue } from '../useMessageParser';

/**
 * Installe les dépendances du socle pendant que le modèle écrit le produit.
 *
 * `npm install` était jusqu'ici lancé après la génération, parce que c'est le
 * modèle qui écrivait `package.json` : impossible d'installer avant de savoir
 * ce qu'il allait demander. Le socle a un manifeste figé et verrouillé, donc
 * l'installation peut partir dès le montage — soit une minute gagnée sur le
 * premier aperçu, prise sur le temps de génération.
 *
 * La file d'exécution est sérielle : le `npm install` que la fin de génération
 * ajoute attend celui-ci, et retombe sur le cache npm en quelques secondes.
 */

let started = false;

/** Un terminal apparaît quelques instants après le montage de l'atelier. */
const TERMINAL_POLL_MS = 500;
const TERMINAL_POLL_ATTEMPTS = 40;

export async function prewarmInstall(command = 'npm install'): Promise<void> {
  if (started) return;
  started = true;

  for (let attempt = 0; attempt < TERMINAL_POLL_ATTEMPTS; attempt += 1) {
    if (useTerminalStore.getState().getTerminal(0)) {
      console.log(`[scaffold] installation anticipée : ${command}`);
      queue.push(command);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, TERMINAL_POLL_MS));
  }

  // Aucun terminal : rien n'est perdu, la fin de génération relancera
  // l'installation comme avant.
  console.warn("[scaffold] pas de terminal disponible, installation laissée à la génération");
  started = false;
}
