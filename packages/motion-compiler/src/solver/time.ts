/**
 * LE SOLVEUR TEMPOREL — les verbes d'une scène → l'instant de départ de chacun, par contraintes (Cassowary).
 *
 * Il remplace la mise à l'échelle uniforme (`TS`), qui écrasait les pauses en même temps que les mouvements. Chaque
 * verbe est un intervalle [début, fin] (sa durée et sa cascade, aux valeurs du système de design de la scène) :
 *
 *   obligatoires  rien ne part avant l'entrée de la scène ; tout ce qui révèle un texte a fini avant la coupe en
 *                 laissant le TEMPS DE LE LIRE (17 signes/s, 5/6 s au moins) ; « avec » = même départ ;
 *   fortes        le verbe suivant part quand le précédent est fait à 30–50 % (ni en file, ni tous ensemble) ; « après »
 *                 part quand l'autre est fait à 60 % ; au plus N mouvements principaux en même temps (énergie) ;
 *   moyennes      départ calé sur le temps (fort) le plus proche de la musique (±120 ms), ou sur la voix ; une pause de
 *                 0,3–0,75 s avant le moment fort (« stillness before climax ») ;
 *   faibles       le plus tôt possible (les textes s'installent tôt, le reste de la scène sert à lire).
 *
 * Si l'obligatoire est impossible (scène trop courte), les durées se resserrent (jusqu'à 60 %), puis c'est dit.
 */
import * as kiwi from '@lume/kiwi';
import { BEAT_TOLERANCE, CLIMAX_PAUSE, OVERLAP } from '../design/motion';

export interface TimedBeat {
  /** Durée totale du verbe (s), cascade comprise. */
  span: number;
  /** Temps de lecture des textes qu'il révèle (0 : aucun). */
  read: number;
  /** Mouvement principal (compte dans les simultanés) ou d'ambiance (toute la scène, hors calcul). */
  ambient: boolean;
  /** Le moment fort de la scène (pause avant lui). */
  climax?: boolean;
  /** Départ souhaité : sur un temps de la musique, sur un temps fort, sur la voix. */
  sync?: 'downbeat' | 'beat' | 'voice';
  /** Index d'un verbe à suivre (`after`) ou à accompagner (`with`). */
  after?: number;
  with?: number;
}

export interface TimeContext {
  duration: number;
  /** Début possible (après l'entrée de la scène). */
  earliest: number;
  /** Fin de ce qui doit être lu (avant la sortie de couture et une marge). */
  latest: number;
  /** Temps de la musique et temps forts (s, depuis le début de la scène). */
  beats?: number[];
  downbeats?: number[];
  /** Début de la ligne de voix off (s). */
  voiceAt?: number;
  maxSimultaneous: number;
}

export interface TimeSolution {
  starts: number[];
  /** Facteur appliqué aux durées (1 : tenues ; < 1 : resserrées pour tenir). */
  squeeze: number;
  feasible: boolean;
  notes: string[];
}

const nearest = (list: number[] | undefined, t: number) => (list || []).reduce<number | null>((best, b) => (best === null || Math.abs(b - t) < Math.abs(best - t) ? b : best), null);

function attempt(beats: TimedBeat[], ctx: TimeContext, squeeze: number): number[] | null {
  const solver = new kiwi.Solver();
  const s = beats.map((_, i) => new kiwi.Variable(`b${i}`));
  const C = (e: kiwi.Expression, op: kiwi.Operator, w: number) => solver.addConstraint(new kiwi.Constraint(e, op, 0, w));
  try {
    const main = beats.map((b, i) => ({ b, i })).filter((x) => !x.b.ambient);
    beats.forEach((b, i) => {
      const span = b.span * squeeze;
      if (b.ambient) {
        C(new kiwi.Expression(s[i]), kiwi.Operator.Eq, kiwi.Strength.required);
        return;
      }
      C(new kiwi.Expression(s[i], -ctx.earliest), kiwi.Operator.Ge, kiwi.Strength.required);
      // Fini avant la coupe… et lu : la révélation d'un texte laisse son temps de lecture avant la fin utile.
      C(new kiwi.Expression(s[i], span + (b.read || 0) - ctx.latest), kiwi.Operator.Le, kiwi.Strength.required);
      C(new kiwi.Expression(s[i], -ctx.earliest), kiwi.Operator.Eq, kiwi.Strength.weak);
      if (b.with !== undefined && s[b.with]) C(new kiwi.Expression(s[i], [-1, s[b.with]]), kiwi.Operator.Eq, kiwi.Strength.required);
      if (b.after !== undefined && s[b.after]) {
        const prev = beats[b.after].span * squeeze;
        C(new kiwi.Expression(s[i], [-1, s[b.after]], -0.6 * prev), kiwi.Operator.Ge, kiwi.Strength.strong);
      }
      // Le suivant part quand le précédent est fait à 30–50 % : une vague, pas une file ni un bloc.
      const k = main.findIndex((x) => x.i === i);
      if (k > 0 && b.with === undefined) {
        const p = main[k - 1];
        const pspan = p.b.span * squeeze;
        C(new kiwi.Expression(s[i], [-1, s[p.i]], -OVERLAP.min * pspan), kiwi.Operator.Ge, kiwi.Strength.strong);
        C(new kiwi.Expression(s[i], [-1, s[p.i]], -OVERLAP.max * pspan), kiwi.Operator.Le, kiwi.Strength.medium);
        // Au plus N mouvements principaux en même temps : celui d'il y a N rangs doit avoir fini.
        if (k >= ctx.maxSimultaneous) {
          const q = main[k - ctx.maxSimultaneous];
          C(new kiwi.Expression(s[i], [-1, s[q.i]], -q.b.span * squeeze), kiwi.Operator.Ge, kiwi.Strength.strong);
        }
        // Le moment fort : une pause avant lui (après la fin du précédent).
        if (b.climax) C(new kiwi.Expression(s[i], [-1, s[p.i]], -(pspan + (CLIMAX_PAUSE.min + CLIMAX_PAUSE.max) / 2)), kiwi.Operator.Ge, kiwi.Strength.medium);
      }
    });
    solver.updateVariables();
    // Le calage sur la musique ou la voix, une fois la forme trouvée : le départ glisse au temps le plus proche si la
    // contrainte obligatoire tient encore (moyenne : une demande, pas une loi).
    beats.forEach((b, i) => {
      if (b.ambient || !b.sync) return;
      const at = s[i].value();
      const goal = b.sync === 'voice' ? ctx.voiceAt : nearest(b.sync === 'downbeat' ? ctx.downbeats?.length ? ctx.downbeats : ctx.beats : ctx.beats, at);
      if (goal === null || goal === undefined || Math.abs(goal - at) > (b.sync === 'voice' ? 1.2 : BEAT_TOLERANCE)) return;
      C(new kiwi.Expression(s[i], -goal), kiwi.Operator.Eq, kiwi.Strength.medium);
    });
    solver.updateVariables();
  } catch {
    return null;
  }
  return s.map((v) => Math.max(0, Math.round(v.value() * 1000) / 1000));
}

export function solveTiming(beats: TimedBeat[], ctx: TimeContext): TimeSolution {
  const notes: string[] = [];
  for (const squeeze of [1, 0.85, 0.72, 0.6]) {
    const starts = attempt(beats, ctx, squeeze);
    if (starts) {
      if (squeeze < 1) notes.push(`durées resserrées à ${Math.round(squeeze * 100)} % pour laisser le temps de lire`);
      return { starts, squeeze, feasible: true, notes };
    }
  }
  // Impossible même resserré : à la file, au plus tôt, et c'est dit (le juge le relèvera).
  let t = ctx.earliest;
  const starts = beats.map((b) => {
    if (b.ambient) return 0;
    const at = t;
    t += b.span * 0.6 * OVERLAP.max;
    return Math.round(at * 1000) / 1000;
  });
  notes.push('la scène est trop courte pour laisser lire chaque texte');
  return { starts, squeeze: 0.6, feasible: false, notes };
}
