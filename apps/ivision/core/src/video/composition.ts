/**
 * LA COMPOSITION DU FILM — ce que l'orchestrateur HyperFrames demande au système de design partagé
 * (`packages/motion-compiler/src/design`) :
 *
 *   planFilm   la direction visuelle (jamais la même deux films de suite), l'énergie de chaque scène, le
 *              système de design du film, les coutures et les sons des transitions ;
 *   seamsOf    la couture d'entrée et de sortie d'une scène, avec la couleur de la suivante ;
 *   plannedCues les sons des transitions planifiés, en instants absolus.
 */
import type { FilmBrand } from './assets/brand';
import type { MotionVideo, SfxKind, VideoFilm } from './contracts/model';
import { buildFilmDesign, DIRECTION_IDS, DIRECTIONS, energyArc, planSeams, planTransitionCues, roleOf } from '../../../../../packages/motion-compiler/src';
import type { DirectionId, FilmDesign, SeamSpec, TransitionCue } from '../../../../../packages/motion-compiler/src';

/** Un son de transition planifié, en instant absolu dans le film. */
export interface PlannedCue {
  kind: SfxKind;
  t: number;
  scene: string;
  gain?: number;
  take?: number;
}

// ─── Le film ─────────────────────────────────────────────────────────────────

export interface FilmPlan {
  design: FilmDesign;
  seams: SeamSpec[];
  cues: TransitionCue[];
  roles: (string | undefined)[];
  direction: { id: DirectionId; alternative?: DirectionId; repeatedAvoided?: boolean };
}

/**
 * La direction (celle du directeur ; si elle vient de servir au film précédent, sa seconde, sinon la suivante de la
 * liste), l'énergie (planificateur › directeur › rôles), le système de design, les coutures, les sons.
 */
export function planFilm(input: { brand: FilmBrand; scenes: { role?: string; energy?: number }[]; direction?: DirectionId; alternative?: DirectionId; energy?: number[]; previousDirection?: string; seed: number }): FilmPlan {
  let id: DirectionId = input.direction || DIRECTION_IDS[input.seed % DIRECTION_IDS.length];
  let repeatedAvoided = false;
  if (input.previousDirection && id === input.previousDirection) {
    repeatedAvoided = true;
    id = input.alternative && input.alternative !== input.previousDirection ? input.alternative : DIRECTION_IDS[(DIRECTION_IDS.indexOf(id) + 1) % DIRECTION_IDS.length];
  }
  const roles = input.scenes.map((s) => roleOf(s.role));
  const given = input.scenes.map((s, i) => s.energy ?? input.energy?.[i]);
  const energy = energyArc(roles, DIRECTIONS[id].energyBias, given);
  const design = buildFilmDesign({ brand: input.brand.tokens.colors, direction: id, energy });
  const seams = planSeams(design, roles, energy, input.seed);
  return { design, seams, cues: planTransitionCues(seams, energy), roles, direction: { id, ...(input.alternative ? { alternative: input.alternative } : {}), ...(repeatedAvoided ? { repeatedAvoided } : {}) } };
}

/**
 * Les sons planifiés, en instants absolus : ceux des transitions (le pic du son tombe sur la coupe) et, depuis le
 * 22/11/2026, ceux des TEMPS FORTS VISUELS des scènes du catalogue (`accents`) — un léger « pop » quand le chiffre ou
 * le titre d'une scène énergique se pose, un « tick » quand un trait se dessine. Le son suit la perception du mouvement
 * (là où il se pose), pas son départ ; `refineCues` borne ensuite la densité.
 */
export function plannedCues(film: VideoFilm): PlannedCue[] {
  const transitions = (film.transitionCues || [])
    .map((c) => {
      const sc = film.scenes[c.scene];
      if (!sc) return null;
      return { kind: c.kind, t: Math.max(0, Math.round((sc.start - c.lead) * 1000) / 1000), scene: sc.key, gain: c.gain, take: c.take };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const accents: PlannedCue[] = [];
  for (const sc of film.scenes) {
    const data = /^__ge\.scene\(tl, root, D, (\{[\s\S]*\})\);$/.exec((sc.script || '').trim())?.[1];
    if (!data) continue;
    let list: Array<{ t: number; kind: string }> = [];
    try {
      list = (JSON.parse(data).accents ?? []) as Array<{ t: number; kind: string }>;
    } catch {
      continue;
    }
    for (const a of list) {
      if (!(a.t > 0 && a.t < sc.duration)) continue;
      const t = Math.round((sc.start + a.t) * 1000) / 1000;
      // Une coupe sonore tout près : le son de la transition suffit.
      if (transitions.some((c) => Math.abs(c.t - t) < 0.35)) continue;
      if (a.kind === 'settle' && (sc.energy ?? 3) >= 4) accents.push({ kind: 'pop', t, scene: sc.key, gain: 0.55 });
      else if (a.kind === 'mark') accents.push({ kind: 'tick', t, scene: sc.key, gain: 0.45 });
    }
  }
  return [...transitions, ...accents].sort((a, b) => a.t - b.t);
}

