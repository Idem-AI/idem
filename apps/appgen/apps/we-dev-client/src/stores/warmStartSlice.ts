/**
 * Où en est le démarrage de l'atelier, en mots que l'utilisateur peut lire.
 *
 * `runStatus` dit déjà ce que font les commandes, mais en termes de commandes
 * (« installing », « starting ») et sur une sortie de terminal. Ce store-ci
 * porte autre chose : ce qu'on affiche à quelqu'un qui vient d'ouvrir son
 * projet et qui veut savoir si ça avance.
 *
 * La règle qu'il applique : **une seule étape à la fois, nommée, et une
 * progression chiffrée quand elle existe**. Un téléchargement de 17 Mo sur une
 * connexion lente sans barre ressemble à un blocage ; avec une barre, c'est une
 * attente. Ce n'est pas la même expérience pour la même durée.
 */

import { create } from 'zustand';
import type { DepsProgress } from '@/components/WeIde/services/webcontainer/deps';
import type { DepsTargetName } from '@/api/deps';

export type WarmStep =
  | 'idle'
  /** Conteneur en train de démarrer, plan demandé. */
  | 'warming'
  /** Téléchargement de l'arbre de dépendances. */
  | 'downloading'
  /** Arbre posé dans l'espace de travail. */
  | 'mounting'
  /** `npm install`, le chemin de secours. */
  | 'installing'
  /** Serveur de développement lancé, on attend `server-ready`. */
  | 'starting'
  /** L'aperçu répond. */
  | 'ready'
  | 'failed';

interface WarmStartState {
  step: WarmStep;
  target: DepsTargetName | null;
  /** Entre 0 et 1 pendant un téléchargement, sinon `null`. */
  ratio: number | null;
  bytes: number;
  totalBytes: number;
  /** Pourquoi on est retombé : 'deps' quand les dépendances ont échoué. */
  reason: string | null;
  begin: (target: DepsTargetName) => void;
  progress: (progress: DepsProgress) => void;
  serverStarting: () => void;
  markReady: () => void;
  fail: (reason: string) => void;
  reset: () => void;
}

const useWarmStart = create<WarmStartState>((set, get) => ({
  step: 'idle',
  target: null,
  ratio: null,
  bytes: 0,
  totalBytes: 0,
  reason: null,

  begin: (target) => set({ step: 'warming', target, reason: null }),

  progress: (progress) => {
    switch (progress.step) {
      case 'plan':
        set({ step: 'warming' });
        return;
      case 'download':
        set({
          step: 'downloading',
          ratio: progress.ratio ?? null,
          bytes: progress.bytes ?? 0,
          totalBytes: progress.totalBytes ?? 0,
        });
        return;
      case 'mount':
      case 'verify':
        set({ step: 'mounting', ratio: null });
        return;
      case 'npm':
        set({ step: 'installing', ratio: null });
        return;
      case 'done':
        // L'étape suivante est le lancement du serveur : on ne repasse pas par
        // « prêt » ici, l'aperçu seul peut le dire.
        return;
    }
  },

  serverStarting: () => set({ step: 'starting', ratio: null }),

  // L'aperçu est la seule preuve : c'est `server-ready` qui appelle ceci.
  markReady: () => set({ step: 'ready', ratio: null, reason: null }),

  fail: (reason) => {
    // Un échec après que l'aperçu a répondu n'est pas un échec de démarrage.
    if (get().step === 'ready') return;
    set({ step: 'failed', reason });
  },

  reset: () => set({ step: 'idle', target: null, ratio: null, bytes: 0, totalBytes: 0, reason: null }),
}));

export default useWarmStart;
