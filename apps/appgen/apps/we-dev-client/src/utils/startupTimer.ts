import { onServerReady, getLastServerUrl } from '@/components/WeIde/services/webcontainer/instance';

/**
 * LE CHRONOMÈTRE DU DÉMARRAGE — objectif : un aperçu en moins de 20 secondes.
 *
 * Il part au premier geste qui doit aboutir à un aperçu (démarrage à chaud, fin de génération, relance) et
 * s'arrête au `server-ready`. Chaque phase (dépendances, démarrage du serveur) et la source des dépendances
 * (cache, instantané, voisin + npm, npm) sont notées : la console le dit tout de suite, le serveur le journalise
 * (`chat.startup`, avertissement au-delà de 20 s) — c'est ce qui permet de tenir l'objectif, pas seulement de
 * l'espérer.
 */
const BUDGET_MS = 20_000;

let startedAt: number | null = null;
let trigger = '';
let target = '';
let phases: Record<string, number> = {};
let sources: string[] = [];
let unsubscribe: (() => void) | null = null;

export function startupBegin(why: string, forTarget = ''): void {
  // Un aperçu déjà là : rien à mesurer. Une mesure en cours : elle continue (le premier geste compte).
  if (startedAt !== null || getLastServerUrl()) return;
  startedAt = performance.now();
  trigger = why;
  target = forTarget;
  phases = {};
  sources = [];
  unsubscribe = onServerReady(() => finish());
}

/** La durée d'une phase (ms), additionnée si elle revient. */
export function startupPhase(name: string, ms: number): void {
  if (startedAt === null) return;
  phases[name] = (phases[name] ?? 0) + Math.round(ms);
}

export function startupSource(source: string): void {
  if (startedAt !== null && !sources.includes(source)) sources.push(source);
}

/** Le conteneur a été remplacé : la mesure en cours ne veut plus rien dire. */
export function startupReset(): void {
  unsubscribe?.();
  unsubscribe = null;
  startedAt = null;
}

function finish(): void {
  if (startedAt === null) return;
  const ms = Math.round(performance.now() - startedAt);
  const report = { trigger, target, ms, phases, sources };
  unsubscribe?.();
  unsubscribe = null;
  startedAt = null;
  const slowest = Object.entries(phases).sort((a, b) => b[1] - a[1])[0];
  const line = `[démarrage] aperçu en ${(ms / 1000).toFixed(1)} s (${trigger}${sources.length ? `, ${sources.join(' + ')}` : ''})${slowest ? ` — phase la plus longue : ${slowest[0]} ${(slowest[1] / 1000).toFixed(1)} s` : ''}`;
  if (ms > BUDGET_MS) console.warn(`${line} — au-delà de l'objectif de 20 s`);
  else console.log(line);
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
