/**
 * LE CALAGE MUSICAL HIÉRARCHIQUE (24/11/2026).
 *
 * Deux enseignements de la recherche, appliqués au catalogue :
 *   · le « temps » d'une image, c'est l'instant où le mouvement S'ARRÊTE (Davis & Agrawala, « Visual Rhythm and Beat »,
 *     SIGGRAPH 2018 : les temps visuels sont des impacts, des décélérations) — on cale donc la POSE du rôle principal,
 *     pas le départ de son tween (avant : le départ du titre était calé sur le temps suivant) ;
 *   · l'alignement n'a de valeur que sur les temps qui comptent (MVAA, 2025 : appariement de pics de mouvement et de
 *     temps) — la phrase musicale porte la révélation, la mesure porte le titre, un simple temps ne sert qu'une scène
 *     vive. Caler chaque mouvement sur chaque temps donnerait une animation mécanique.
 *
 * La voix passe avant la musique : une scène dite garde ses entrées sur les mots (l'appelant ne cale pas).
 */

export interface SceneGrid {
  bpm: number;
  /** Le premier temps (s, depuis le début de la scène) : grille régulière de secours. */
  first: number;
  /** Les temps trouvés par BeatRoot, les temps forts (premiers temps des mesures) et les débuts de phrase (s, locaux). */
  beats?: number[];
  downbeats?: number[];
  phrases?: number[];
}

/** Les rôles de scène qui portent une révélation (une phrase musicale leur va). */
const REVEAL_ROLES = new Set(['hook', 'reveal', 'cta', 'signature', 'statement']);

/** Le poids d'un niveau de la grille, et le coût d'un écart (par seconde). */
const WEIGHT = { phrase: 3, downbeat: 2, beat: 1 };
const COST_PER_S = 4;

/**
 * Le décalage (s) à donner à la POSE du rôle principal pour tomber sur un temps qui compte ; 0 si aucun temps ne vaut
 * le déplacement. `landing` : l'instant de la pose (s, depuis le début de la scène). `late` / `early` : les bornes du
 * déplacement permis (on préfère retarder : avancer rogne l'entrée d'avant).
 */
export function landingShift(landing: number, grid: SceneGrid, o: { energy: number; role?: string; late?: number; early?: number }): number {
  const late = o.late ?? 0.35;
  const early = o.early ?? 0.1;
  const targets: Array<{ t: number; w: number }> = [];
  const add = (list: number[] | undefined, w: number) => {
    for (const t of list ?? []) targets.push({ t, w });
  };
  if (grid.beats?.length) {
    add(grid.phrases, WEIGHT.phrase + (REVEAL_ROLES.has(o.role ?? '') ? 1 : 0));
    add(grid.downbeats, WEIGHT.downbeat);
    // Un simple temps ne sert qu'une scène vive (énergie ≥ 3) ; une scène posée ne se cale que sur la mesure.
    if (o.energy >= 3) add(grid.beats, WEIGHT.beat);
  } else if (grid.bpm > 0 && o.energy >= 3) {
    // Sans grille trouvée : la grille régulière du tempo (on ne sait pas où sont les mesures).
    const period = 60 / grid.bpm;
    for (let k = Math.floor((landing - early - grid.first) / period); k <= Math.ceil((landing + late - grid.first) / period); k++) targets.push({ t: grid.first + k * period, w: WEIGHT.beat });
  }
  let best = { d: 0, s: 0 };
  for (const x of targets) {
    const d = x.t - landing;
    if (d < -early || d > late) continue;
    const s = x.w - COST_PER_S * Math.abs(d);
    // Un temps à moins de 30 ms : la pose y est déjà, rien à déplacer.
    if (Math.abs(d) <= 0.03 && s > 0) return 0;
    if (s > best.s) best = { d, s };
  }
  return Math.round(best.d * 1000) / 1000;
}

/** Le temps fort (temps de mesure, sinon temps) le plus proche d'un instant, dans ± `tol` s ; `undefined` sinon. */
export function nearestStrong(t: number, grid: SceneGrid, tol = 0.3): number | undefined {
  const list = grid.downbeats?.length ? grid.downbeats : undefined;
  if (!list) return undefined;
  let best: number | undefined;
  for (const b of list) if (Math.abs(b - t) <= tol && (best === undefined || Math.abs(b - t) < Math.abs(best - t))) best = b;
  return best;
}

/**
 * LE SCORE D'ALIGNEMENT (beat alignment score, comme MVAA et les travaux sur la danse) : pour chaque temps fort visuel
 * (pose, trait), l'écart au temps musical le plus proche, noté exp(−d² / 2σ²) avec σ = 80 ms ; moyenne sur le film.
 * 1 : tout tombe sur la musique ; ≈ 0,3 : au hasard.
 */
export function beatAlignScore(accents: Array<{ t: number; beats: number[] }>, sigma = 0.08): number | undefined {
  const scored = accents.filter((a) => a.beats.length);
  if (!scored.length) return undefined;
  const total = scored.reduce((n, a) => {
    const d = Math.min(...a.beats.map((b) => Math.abs(b - a.t)));
    return n + Math.exp(-(d * d) / (2 * sigma * sigma));
  }, 0);
  return Math.round((total / scored.length) * 100) / 100;
}
