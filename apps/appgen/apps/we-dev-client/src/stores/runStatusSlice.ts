import { create } from 'zustand';

/**
 * Où en est l'exécution du projet dans la WebContainer, lu sur la sortie des
 * commandes lancées par « Exécuter » ou par l'IA (`npm install`, `npm run dev`).
 *
 * Une application complète tourne en trois morceaux — base de données (PGlite,
 * dans le serveur), serveur `backend/` (`[api]`), interface `frontend/`
 * (`[web]`) — lancés ensemble par `concurrently`. Ce store en tire un état
 * simple pour l'utilisateur et, en cas d'échec, l'erreur à corriger.
 */
export type RunPhase = 'idle' | 'installing' | 'starting' | 'ready' | 'error';
export type RunErrorSource = 'install' | 'api' | 'web';

export interface RunError {
  source: RunErrorSource;
  /** La ligne qui dit l'erreur, lisible telle quelle. */
  summary: string;
  /** Les dernières lignes de sortie, envoyées à l'IA pour la correction. */
  log: string;
}

/** Port du serveur `backend/` dans l'aperçu (contrat de la skill full-stack). */
export const API_PORT = 3001;

const MAX_LINES = 200;
const LOG_LINES_FOR_FIX = 60;

// Couleurs et curseur ANSI, et horodatage de Vite (« 2:48:41 AM ») en tête de ligne.
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;
const strip = (line: string) => line.replace(ANSI, '').replace(/\r/g, '').trimEnd();

/**
 * Ce qui est une vraie erreur. Volontairement précis : un mot « error » au
 * milieu d'un journal ne suffit pas (« 0 errors », noms de fichiers…).
 */
const ERROR_PATTERNS: RegExp[] = [
  /npm ERR!/,
  /^npm error /,
  /\[vite\] Internal server error/,
  /\[vite\] Pre-transform error/,
  /Failed to resolve import/,
  /\[plugin:vite:[^\]]+\]/,
  /error during build/i,
  /✘ \[ERROR\]/,
  /\b(SyntaxError|ReferenceError|TypeError|RangeError):/,
  /Error: Cannot find module/,
  /ERR_MODULE_NOT_FOUND/,
  /EADDRINUSE/,
  /exited with code [1-9]/,
];

/**
 * Le bruit normal d'un démarrage : l'interface est prête une seconde avant le
 * serveur, et le relais `/api` échoue le temps qu'il s'ouvre.
 */
const TRANSIENT_PATTERNS: RegExp[] = [/http proxy error/i, /ECONNREFUSED/, /AggregateError/];

/** Ce qui montre que ça tourne de nouveau (après une correction, par exemple). */
const RECOVERY_PATTERNS: Array<{ pattern: RegExp; clears: RunErrorSource[] }> = [
  { pattern: /hmr update|page reload/i, clears: ['web'] },
  { pattern: /ready in \d/i, clears: ['web'] },
  { pattern: /listening on/i, clears: ['api'] },
];

function sourceOf(line: string, fallback: RunErrorSource): RunErrorSource {
  if (line.startsWith('[api]')) return 'api';
  if (line.startsWith('[web]')) return 'web';
  return fallback;
}

interface RunStatusState {
  phase: RunPhase;
  error: RunError | null;
  lines: string[];
  /** Fin de ligne pas encore reçue : la sortie arrive par morceaux arbitraires. */
  pending: string;
  /** Commande en cours, pour savoir d'où vient une sortie sans préfixe. */
  current: 'install' | 'dev' | null;
  commandStarted: (command: string) => void;
  feed: (chunk: string) => void;
  commandExited: (command: string, exitCode: number) => void;
  markReady: () => void;
  clearError: () => void;
  reset: () => void;
}

const isInstall = (command: string) => /\bnpm\s+(i|install|ci)\b/.test(command);
const isDev = (command: string) => /\bnpm\s+(run\s+)?(dev|start)\b/.test(command);

const useRunStatus = create<RunStatusState>((set, get) => ({
  phase: 'idle',
  error: null,
  lines: [],
  pending: '',
  current: null,

  commandStarted: (command) => {
    if (isInstall(command)) set({ phase: 'installing', error: null, current: 'install' });
    else if (isDev(command)) set({ phase: 'starting', error: null, current: 'dev' });
  },

  feed: (chunk) => {
    // Une ligne coupée entre deux morceaux échapperait aux motifs : on garde la
    // fin incomplète jusqu'au morceau suivant.
    const parts = (get().pending + chunk).split('\n');
    set({ pending: parts.pop() ?? '' });
    const incoming = parts.map(strip).filter(Boolean);
    if (!incoming.length) return;

    const lines = [...get().lines, ...incoming].slice(-MAX_LINES);
    let { error, phase } = get();
    const fallback: RunErrorSource = get().current === 'install' ? 'install' : 'web';

    for (const line of incoming) {
      if (TRANSIENT_PATTERNS.some((pattern) => pattern.test(line))) continue;

      const recovery = RECOVERY_PATTERNS.find(({ pattern }) => pattern.test(line));
      if (recovery && error && recovery.clears.includes(error.source)) {
        error = null;
        phase = 'ready';
        continue;
      }

      // La première erreur est la cause ; les suivantes en sont souvent l'écho.
      if (!error && ERROR_PATTERNS.some((pattern) => pattern.test(line))) {
        error = {
          source: sourceOf(line, fallback),
          summary: line
            .replace(/^\[(api|web)\]\s*/, '')
            .replace(/^\d{1,2}:\d{2}:\d{2}(\s?[AP]M)?\s+/i, '')
            .slice(0, 220),
          log: '',
        };
        phase = 'error';
      }
    }

    if (error && !error.log) error = { ...error, log: lines.slice(-LOG_LINES_FOR_FIX).join('\n') };
    set({ lines, error, phase });
  },

  commandExited: (command, exitCode) => {
    // La dernière ligne, si elle n'a pas fini par un retour à la ligne.
    if (get().pending) get().feed('\n');
    if (exitCode === 0) {
      if (isInstall(command) && get().phase === 'installing') set({ phase: 'starting', current: null });
      return;
    }
    // Une commande qui s'arrête en échec sans message reconnu reste une erreur.
    if (get().error) return;
    const lines = get().lines;
    set({
      phase: 'error',
      current: null,
      error: {
        source: isInstall(command) ? 'install' : 'web',
        summary: lines[lines.length - 1]?.slice(0, 220) || `${command} (code ${exitCode})`,
        log: lines.slice(-LOG_LINES_FOR_FIX).join('\n'),
      },
    });
  },

  markReady: () => {
    if (get().phase !== 'error') set({ phase: 'ready' });
  },

  clearError: () => set({ error: null, phase: get().phase === 'error' ? 'starting' : get().phase }),

  reset: () => set({ phase: 'idle', error: null, lines: [], pending: '', current: null }),
}));

export default useRunStatus;
