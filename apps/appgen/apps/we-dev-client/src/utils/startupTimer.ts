import { onServerReady, getLastServerUrl } from '@/components/WeIde/services/webcontainer/instance';

/**
 * LE CHRONOMÈTRE DU DÉMARRAGE — objectif : une page affichée en moins de 20 secondes.
 *
 * Il part au premier geste qui doit aboutir à un aperçu (démarrage à chaud, fin de génération, relance) et
 * s'arrête quand l'aperçu a CHARGÉ sa page (évènement `load` de l'iframe), pas au `server-ready` : Vite ouvre son
 * port avant d'avoir pré-regroupé les dépendances, et la première page attendait encore ce regroupement — l'attente
 * la plus longue était invisible dans la mesure. Chaque phase est notée (démarrage du conteneur, lecture du cache,
 * montage, droits, vérification, npm, serveur, page) avec la source des dépendances : la console le dit tout de
 * suite, le serveur le journalise (`chat.startup`, avertissement au-delà de 20 s).
 */
const BUDGET_MS = 20_000;

/** Au-delà, la page n'a pas chargé (erreur de compilation, onglet caché) : la mesure s'arrête au serveur. */
const PAGE_WAIT_MS = 60_000;

let startedAt: number | null = null;
let serverAt: number | null = null;
let trigger = '';
let target = '';
let phases: Record<string, number> = {};
let sources: string[] = [];
let unsubscribe: (() => void) | null = null;
let pageTimer: ReturnType<typeof setTimeout> | undefined;

export function startupBegin(why: string, forTarget = ''): void {
  // Un aperçu déjà là : rien à mesurer. Une mesure en cours : elle continue (le premier geste compte).
  if (startedAt !== null || getLastServerUrl()) return;
  startedAt = performance.now();
  serverAt = null;
  trigger = why;
  target = forTarget;
  phases = {};
  sources = [];
  unsubscribe = onServerReady(() => serverReady());
}

/** La durée d'une phase (ms), additionnée si elle revient. */
export function startupPhase(name: string, ms: number): void {
  if (startedAt === null) return;
  phases[name] = (phases[name] ?? 0) + Math.round(ms);
}

/** Chronomètre une étape : `await timed('mount', () => …)`. */
export async function timed<T>(name: string, task: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try {
    return await task();
  } finally {
    startupPhase(name, performance.now() - started);
  }
}

export function startupSource(source: string): void {
  if (startedAt !== null && !sources.includes(source)) sources.push(source);
}

/** Le conteneur a été remplacé : la mesure en cours ne veut plus rien dire. */
export function startupReset(): void {
  unsubscribe?.();
  unsubscribe = null;
  clearTimeout(pageTimer);
  startedAt = null;
  serverAt = null;
}

function serverReady(): void {
  if (startedAt === null || serverAt !== null) return;
  serverAt = performance.now();
  // Ce que les phases notées n'expliquent pas, jusqu'au serveur : le lancement de Vite et son ouverture de port.
  // (Les sous-phases `deps.*` détaillent `dependencies` : comptées une fois.)
  const noted = Object.entries(phases).reduce((sum, [name, ms]) => (name.includes('.') ? sum : sum + ms), 0);
  startupPhase('server', Math.max(0, serverAt - startedAt - noted));
  clearTimeout(pageTimer);
  pageTimer = setTimeout(() => finish('no-page'), PAGE_WAIT_MS);
}

/** L'iframe de l'aperçu a chargé sa page : c'est la fin de l'attente pour l'utilisateur. */
export function startupPageLoaded(): void {
  if (startedAt === null || serverAt === null) return;
  startupPhase('page', performance.now() - serverAt);
  finish('page');
}

function finish(end: 'page' | 'no-page'): void {
  if (startedAt === null) return;
  clearTimeout(pageTimer);
  // Sans page chargée, la mesure s'arrête au serveur : c'est le seul instant certain.
  const ms = Math.round((end === 'page' ? performance.now() : (serverAt ?? performance.now())) - startedAt);
  const report = { trigger, target, ms, end, phases, sources };
  unsubscribe?.();
  unsubscribe = null;
  startedAt = null;
  serverAt = null;
  const slowest = Object.entries(phases).sort((a, b) => b[1] - a[1])[0];
  const line = `[démarrage] page affichée en ${(ms / 1000).toFixed(1)} s (${trigger}${sources.length ? `, ${sources.join(' + ')}` : ''})${slowest ? ` — phase la plus longue : ${slowest[0]} ${(slowest[1] / 1000).toFixed(1)} s` : ''}`;
  if (ms > BUDGET_MS) console.warn(`${line} — au-delà de l'objectif de 20 s`, phases);
  else console.log(line, phases);
  try {
    void fetch(`${process.env.REACT_APP_BASE_URL || ''}/api/scaffold/deps/startup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* la mesure est un confort */
  }
}
