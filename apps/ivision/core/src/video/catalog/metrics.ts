/**
 * LES MESURES D'UN FILM (22/11/2026) — ce qui distingue un film d'un diaporama, chiffré par le code à partir des scènes
 * assemblées (aucun rendu, aucun modèle). Idées reprises (et recodées) de la revue des outils ouverts :
 *
 *   continuité   à chaque coupe, quelque chose passe-t-il d'une scène à l'autre ? un élément PORTÉ (traversée) vaut 1,
 *                la même image restée à l'écran vaut 0,5, rien ne vaut 0 — la moyenne des coupes (onetake) ;
 *   cadence      les durées des scènes varient-elles ? (coefficient de variation ; des durées toutes égales = des
 *                diapositives, onetake exige ≥ 0,25) ;
 *   sujet        la part du film où un sujet concret est à l'écran (une image, un chiffre) — Bang Motion veut ≥ 60 % ;
 *   transitions  les sortes de coupes employées (jamais la même transition à toutes les coupes d'un long film) ;
 *   retenue      le plus grand nombre d'entrées qui se jouent EN MÊME TEMPS dans une scène (motion-anything : ≤ 3) ;
 *   temps mort   le total des tenues sans mouvement utile après lecture (`SceneQuality.idle`).
 *
 * Depuis le 24/11/2026 (étude « moteur mathématique ») — mesurées d'abord, seuils plus tard (après des films vus) :
 *   alignement   le score d'alignement des temps forts visuels (poses, traits) sur la musique (`rhythm.ts`, σ = 80 ms) ;
 *   répétitions  les enchaînements qui répètent une mise en page, un gabarit ou l'entrée du titre ;
 *   courbes      les arrivées en courbe cinématique (DA joueuses) et les grands déplacements en jerk minimal.
 */
import type { CatalogScene, ComposedScene } from './compose';
import type { RuntimeScene } from './assemble';
import { beatAlignScore } from './rhythm';
import { KINEMATIC_EASE_NAMES } from './kinematics';

export interface FilmMetrics {
  continuity: number;
  cuts: { carried: number; anchored: number; bare: number };
  cadence: number;
  subject: number;
  transitions: number;
  simultaneous: number;
  idle: number;
  /** Alignement des temps forts visuels sur la musique (0..1) ; absent sans grille musicale. */
  beatAlign?: number;
  /** Enchaînements qui répètent : même mise en page, même gabarit, même animation de titre. */
  repeats: { layout: number; gabarit: number; title: number };
  /** Pas posés en courbe cinématique (geJerk, geSettle, geKin). */
  kinematic: number;
}

/** Le contrat de scène (données de la chorégraphie) d'une scène assemblée. */
export function specOf(script: string): RuntimeScene | null {
  const m = /^__ge\.scene\(tl, root, D, (\{[\s\S]*\})\);$/.exec(String(script || '').trim());
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as RuntimeScene;
  } catch {
    return null;
  }
}

/** Le plus grand nombre de rôles dont l'entrée est en cours au même instant (fenêtres de 0,05 s). */
function maxSimultaneous(spec: RuntimeScene): number {
  const spans = spec.roles
    .filter((r) => r.role !== 'bg' && r.in.length)
    .map((r) => {
      const len = r.in.reduce((n, s) => Math.max(n, (s.at ?? 0) + s.duration + (s.stagger ?? 0) * 2), 0);
      const start = r.cues?.length ? r.cues[0] : r.at;
      const end = r.cues?.length ? r.cues[r.cues.length - 1] + len : r.at + len;
      return [start, end] as const;
    });
  let best = 0;
  for (const [a] of spans) best = Math.max(best, spans.filter(([s, e]) => s <= a + 0.05 && e > a + 0.05).length);
  return best;
}

export function filmMetrics(composed: ComposedScene[], scenes: CatalogScene[]): FilmMetrics {
  const cuts = { carried: 0, anchored: 0, bare: 0 };
  for (let i = 1; i < composed.length; i++) {
    if (composed[i].quality?.carry) cuts.carried++;
    else {
      const a = scenes[i - 1]?.media?.[0]?.id;
      const b = scenes[i]?.media?.[0]?.id;
      if (a && a === b) cuts.anchored++;
      else cuts.bare++;
    }
  }
  const n = Math.max(1, composed.length - 1);
  const durations = scenes.map((s) => s.duration);
  const mean = durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length);
  const sd = Math.sqrt(durations.reduce((a, d) => a + (d - mean) ** 2, 0) / Math.max(1, durations.length));
  const total = durations.reduce((a, b) => a + b, 0) || 1;
  const subject = scenes.reduce((a, s) => a + (s.media?.length || Object.keys(s.texts).some((k) => /^(figure|stat|number|metric|price|value)$/i.test(k)) ? s.duration : 0), 0) / total;
  const specs = composed.map((c) => specOf(c.script)).filter((x): x is RuntimeScene => !!x);
  const beatAlign = beatAlignScore(composed.flatMap((c, i) => (specOf(c.script)?.accents ?? []).map((a) => ({ t: a.t, beats: scenes[i]?.beat?.beats ?? [] }))));
  const repeats = { layout: 0, gabarit: 0, title: 0 };
  for (let i = 1; i < composed.length; i++) {
    const a = composed[i - 1].config;
    const b = composed[i].config;
    if (a.sequence && a.sequence === b.sequence) continue;
    if (a.layout === b.layout) repeats.layout++;
    if (a.gabarit && a.gabarit === b.gabarit) repeats.gabarit++;
    if (a.animations?.title && a.animations.title === b.animations?.title) repeats.title++;
  }
  return {
    continuity: Math.round(((cuts.carried + cuts.anchored * 0.5) / n) * 100) / 100,
    cuts,
    cadence: Math.round((sd / (mean || 1)) * 100) / 100,
    subject: Math.round(subject * 100) / 100,
    transitions: new Set(composed.slice(1).map((c) => (c.quality?.carry ? 'carry' : c.config.transition ?? 'cut'))).size,
    simultaneous: Math.max(0, ...specs.map(maxSimultaneous)),
    idle: Math.round(composed.reduce((a, c) => a + (c.quality?.idle ?? 0), 0) * 100) / 100,
    ...(beatAlign !== undefined ? { beatAlign } : {}),
    repeats,
    kinematic: specs.reduce((n, sp) => n + sp.roles.reduce((m, r) => m + [...r.in, ...(r.develop ?? [])].filter((st) => KINEMATIC_EASE_NAMES.includes(st.ease)).length, 0) + (sp.carry && KINEMATIC_EASE_NAMES.includes(sp.carry.ease) ? 1 : 0), 0),
  };
}

/**
 * LA CADENCE (onetake : « des plans tous de la même longueur, c'est un diaporama ») : quand les durées d'un film SANS
 * voix ni scénario sont presque égales (coefficient < 0,2), le code les module selon le rôle de chaque scène — une
 * accroche brève, le temps fort et la preuve plus longs, la signature courte — à durée totale égale et sans passer
 * sous le temps de lecture de chaque scène. Un film avec voix suit la voix ; un scénario garde ses durées.
 */
const ROLE_WEIGHT: Record<string, number> = { hook: 0.8, problem: 1, reveal: 1.25, feature: 1.1, benefits: 1.15, proof: 1.2, data: 1.2, statement: 0.95, cta: 1.05, signature: 0.7 };
export function shapeCadence<T extends { duration: number; role?: string; texts: Record<string, string> }>(scenes: T[], total: number): T[] {
  if (scenes.length < 3) return scenes;
  const d = scenes.map((s) => s.duration);
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const cv = Math.sqrt(d.reduce((a, x) => a + (x - mean) ** 2, 0) / d.length) / (mean || 1);
  if (cv >= 0.2) return scenes;
  const floor = scenes.map((s) => Math.max(1.2, Object.values(s.texts).join(' ').length / 15 + 0.9));
  const w = scenes.map((s) => ROLE_WEIGHT[s.role ?? ''] ?? 1);
  const sumW = w.reduce((a, b) => a + b, 0);
  let next = w.map((x, i) => Math.max(floor[i], (total * x) / sumW));
  const over = next.reduce((a, b) => a + b, 0) - total;
  if (over > 0.001) {
    const room = next.map((x, i) => Math.max(0, x - floor[i]));
    const roomSum = room.reduce((a, b) => a + b, 0);
    if (roomSum < over) return scenes;
    next = next.map((x, i) => x - (over * room[i]) / roomSum);
  }
  return scenes.map((s, i) => ({ ...s, duration: Math.round(next[i] * 1000) / 1000 }));
}
