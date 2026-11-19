/**
 * L'APERÇU INSTANTANÉ d'un site vitrine, côté atelier.
 *
 * La WebContainer demandait 14 à 35 s avant la première page (démarrage du conteneur, `node_modules`, Vite). Ici, les
 * fichiers du site partent au serveur iCode, qui les regroupe (esbuild natif, Tailwind) et sert la page : moins d'une
 * seconde, puis chaque fichier écrit — par la génération ou à la main — est envoyé seul et apparaît en ~0,2 s, sans
 * recharger.
 *
 *   - seulement les sites vitrines du moteur IDEM (le reste garde la WebContainer) ;
 *   - envoi par différences, regroupées sur 120 ms (une génération écrit des dizaines de fichiers d'affilée) ;
 *   - indisponible côté serveur, ou en échec : l'atelier reprend la WebContainer, sans rien demander ;
 *   - la WebContainer continue de tourner derrière : publication, terminal et mode Édition s'en servent.
 *
 * `localStorage['idem.fastPreview'] = 'off'` ou `REACT_APP_FAST_PREVIEW=off` la coupent.
 */
import { create } from 'zustand';
import { useFileStore } from '@/components/WeIde/stores/fileStore';
import useRunStatus from '@/stores/runStatusSlice';

const API_BASE = process.env.REACT_APP_NEXT_API_BASE_URL || 'http://localhost:3000';
const DEBOUNCE_MS = 120;

export type FastPreviewStatus = 'off' | 'starting' | 'ready' | 'unavailable';

interface FastPreviewState {
  /** L'adresse de l'aperçu, dès qu'une session existe. */
  url: string | null;
  status: FastPreviewStatus;
  /** La dernière erreur de construction (le code ne se regroupe pas), ou `null`. */
  error: string | null;
  /** Temps de la dernière construction côté serveur. */
  buildMs: number | null;
}

export const useFastPreview = create<FastPreviewState>(() => ({ url: null, status: 'off', error: null, buildMs: null }));

const disabled = (): boolean => {
  if ((process.env.REACT_APP_FAST_PREVIEW ?? 'on').toLowerCase() === 'off') return true;
  try {
    return localStorage.getItem('idem.fastPreview') === 'off';
  } catch {
    return false;
  }
};

/** Un site vitrine du moteur IDEM : ce que l'aperçu instantané sait afficher. */
export function isSiteProject(files: Record<string, string>): boolean {
  if ('backend/package.json' in files || 'capacitor.config.ts' in files) return false;
  return 'src/site/pages.json' in files || /scripts\/pages\/vite-plugin\.mjs/.test(files['vite.config.ts'] ?? '');
}

/** Ce qui ne part jamais : dépendances, constructions, fichiers internes. */
const SKIPPED = /(^|\/)(node_modules|dist|\.idem|\.git|\.pglite)(\/|$)/;

let available: boolean | null = null;
let session: { id: string; url: string } | null = null;
const synced = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let again = false;
let started = false;

/**
 * Une erreur de construction n'est une vraie erreur que si elle DURE. Pendant une génération, le code passe par des
 * états incomplets (une page arrive avant ses sections, une section avant le fichier qu'elle importe) que les fichiers
 * suivants réparent en une ou deux secondes : les montrer affichait « Corriger » à tort, et le modèle, appelé à réparer
 * un site sain, répondait « sans changer le site ». Chaque nouvel envoi en échec repousse l'échéance ; une version
 * saine l'annule.
 */
const ERROR_PATIENCE_MS = 6000;
let errorTimer: ReturnType<typeof setTimeout> | null = null;
/** La bannière a été levée par l'aperçu instantané (on n'efface que ce qu'on a posé). */
let raised = false;

/** L'erreur de construction, montrée comme celles de Vite (bannière « Corriger ») si elle dure, effacée quand ça repart. */
function reportBuild(state: { ok: boolean; error?: string; ms?: number } | undefined) {
  if (!state) return;
  useFastPreview.setState({ buildMs: state.ms ?? null });
  if (errorTimer) clearTimeout(errorTimer);
  errorTimer = null;
  if (state.ok) {
    useFastPreview.setState({ error: null });
    if (raised && useRunStatus.getState().error?.source === 'web') useRunStatus.getState().clearError();
    raised = false;
    return;
  }
  if (!state.error) return;
  const message = state.error;
  errorTimer = setTimeout(() => {
    errorTimer = null;
    useFastPreview.setState({ error: message });
    useRunStatus.setState({ phase: 'error', error: { source: 'web', summary: message.split('\n')[0], log: message } });
    raised = true;
  }, ERROR_PATIENCE_MS);
}

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${API_BASE}/api/preview${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function flush(): Promise<void> {
  const files = useFileStore.getState().files;
  if (!isSiteProject(files) || disabled()) {
    await close();
    return;
  }
  if (available === null) {
    // « Non » du serveur (paquets absents, coupé) : définitif pour la session. Pas de réponse (serveur qui redémarre) :
    // on redemande un peu plus tard — avant, un seul échec désactivait l'aperçu instantané jusqu'au rechargement.
    available = await request('GET', '/status')
      .then((r) => r.json())
      .then((s: { available?: boolean }) => !!s.available)
      .catch(() => null);
  }
  if (available === null) {
    useFastPreview.setState({ status: 'unavailable' });
    retryLater();
    return;
  }
  if (!available) {
    useFastPreview.setState({ status: 'unavailable' });
    return;
  }

  const current: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) if (typeof content === 'string' && !SKIPPED.test(path)) current[path] = content;

  if (!session) {
    useFastPreview.setState({ status: 'starting' });
    const response = await request('POST', '/sessions', { files: current }).catch(() => null);
    if (!response?.ok) {
      // 503 : le serveur ne sait pas faire (paquets absents) ; autre : on réessaiera au prochain changement.
      if (response?.status === 503) available = false;
      useFastPreview.setState({ status: 'unavailable', url: null });
      // Pas de réponse ou erreur passagère : nouvel essai dans quelques secondes (l'atelier garde la WebContainer d'ici là).
      if (!response || response.status >= 500 && response.status !== 503) {
        available = null;
        retryLater();
      }
      return;
    }
    const opened = (await response.json()) as { id: string; url: string; state: { ok: boolean; error?: string; ms?: number } };
    session = { id: opened.id, url: `${API_BASE}${opened.url}` };
    synced.clear();
    for (const [path, content] of Object.entries(current)) synced.set(path, content);
    useFastPreview.setState({ status: 'ready', url: session.url });
    reportBuild(opened.state);
    return;
  }

  const changed: Record<string, string> = {};
  for (const [path, content] of Object.entries(current)) if (synced.get(path) !== content) changed[path] = content;
  const removed = Array.from(synced.keys()).filter((path) => !(path in current));
  if (!Object.keys(changed).length && !removed.length) return;

  const response = await request('PATCH', `/sessions/${session.id}`, { files: changed, removed }).catch(() => null);
  if (response?.status === 404) {
    // Session fermée (serveur redémarré, inactivité) : on en rouvre une avec tout le site.
    session = null;
    synced.clear();
    return flush();
  }
  if (!response?.ok) {
    // Réseau coupé ou serveur qui redémarre : les changements repartiront au prochain essai.
    retryLater();
    return;
  }
  for (const [path, content] of Object.entries(changed)) synced.set(path, content);
  for (const path of removed) synced.delete(path);
  reportBuild(((await response.json()) as { state?: { ok: boolean; error?: string; ms?: number } }).state);
}

/** Un nouvel essai, 5 s plus tard (serveur qui redémarre). Un seul en attente à la fois. */
let retryTimer: ReturnType<typeof setTimeout> | null = null;
function retryLater() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    schedule();
  }, 5000);
}

/** Un envoi à la fois ; ce qui change pendant un envoi part juste après. */
function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (running) {
      again = true;
      return;
    }
    running = (async () => {
      do {
        again = false;
        await flush().catch((error) => console.warn('[aperçu instantané]', error));
      } while (again);
      running = null;
    })();
  }, DEBOUNCE_MS);
}

/** Ferme la session (projet quitté, ou plus un site). */
async function close() {
  const closing = session;
  session = null;
  synced.clear();
  useFastPreview.setState({ url: null, status: 'off', error: null });
  if (closing) await request('DELETE', `/sessions/${closing.id}`).catch(() => undefined);
}

/** Démarre la synchronisation (une fois par atelier) : chaque changement de fichiers est envoyé. */
export function startFastPreview(): void {
  if (started) return;
  started = true;
  let previous = useFileStore.getState().files;
  useFileStore.subscribe((state) => {
    if (state.files === previous) return;
    // Projet vidé (changement de projet) : la session repart de zéro.
    if (!Object.keys(state.files).length) void close();
    previous = state.files;
    schedule();
  });
  schedule();
  addEventListener('pagehide', () => {
    if (session) navigator.sendBeacon?.(`${API_BASE}/api/preview/sessions/${session.id}/close`);
  });
}
