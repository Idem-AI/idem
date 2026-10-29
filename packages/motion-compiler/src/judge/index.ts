/**
 * LE JUGE DÉTERMINISTE — l'entrée du module : pré-jugement sans rendu (boîtes du solveur) et poids étalonnés.
 */
import fs from 'fs';
import path from 'path';
import type { LowerResult } from '../intent/lower';
import type { SceneIntent } from '../intent/types';
import type { SceneDesign } from '../design/types';
import { compositionMetrics, JudgeElement } from './composition';
import { intentAssertions, motionMetrics } from './motion';
import { DEFAULT_WEIGHTS, judge, Judgment } from './score';
import type { MotionStep } from '../dsl/types';

export * from './composition';
export * from './motion';
export * from './score';
export * from './fit';

let cached: Record<string, number> | null = null;

/** Les poids du juge : `VIDEO_JUDGE_WEIGHTS` (fichier), sinon `judge-weights.json` du paquet, sinon les poids de départ. */
export function judgeWeights(): Record<string, number> {
  if (cached) return cached;
  const candidates = [process.env.VIDEO_JUDGE_WEIGHTS, path.join(__dirname, '../../judge-weights.json')].filter((x): x is string => !!x);
  for (const file of candidates) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { weights?: Record<string, number> };
      if (raw.weights && Object.keys(raw.weights).length) {
        cached = { ...DEFAULT_WEIGHTS, ...raw.weights };
        return cached;
      }
    } catch {
      // fichier suivant
    }
  }
  cached = DEFAULT_WEIGHTS;
  return cached;
}

/** Les boîtes du solveur vues par le juge (u). */
export function placementElements(p: LowerResult['placements'][number]): JudgeElement[] {
  return p.elements.map((e) => ({
    id: e.id,
    kind: e.layer >= 10 ? 'text' : e.kind === 'image' || e.kind === 'video' || e.kind === 'device' ? 'media' : e.kind === 'shape' || e.kind === 'bullet' ? 'shape' : e.kind === 'logo' ? 'logo' : e.kind === 'icon' ? 'icon' : 'other',
    box: e.box,
    ...(e.size ? { size: e.size } : {}),
    rank: e.rank,
  }));
}

/** Le pré-jugement d'une variante, sans rendu : composition (boîtes du solveur), mouvement, intention. */
export function prejudge(intent: SceneIntent, lowered: LowerResult, ctx: { duration: number; design: SceneDesign; beats?: number[]; seamOut?: number }): Judgment {
  const composition = lowered.placements.map((p) => compositionMetrics(placementElements(p), p.frame, { columns: ctx.design.columns, gutter: ctx.design.gutter }));
  const textIds = lowered.placements[0]?.elements.filter((e) => e.layer >= 10).map((e) => e.id) || [];
  const mainId = intent.elements.find((e) => e.rank === 1)?.id;
  const accentIds = lowered.placements[0]?.elements.filter((e) => e.kind === 'shape' || e.kind === 'bullet').map((e) => e.id) || [];
  const motion = motionMetrics(lowered.program.timeline as MotionStep[], { duration: ctx.duration, maxSimultaneous: ctx.design.maxSimultaneous, textIds, accentIds, ...(mainId ? { mainId } : {}), ...(ctx.beats ? { beats: ctx.beats } : {}), collisions: lowered.collisions });
  const assertions = intentAssertions(intent, lowered, { duration: ctx.duration, seamOut: ctx.seamOut });
  const unread = lowered.reveals.filter((r) => r.read > 0 && r.end + r.read > ctx.duration - (ctx.seamOut ?? 0) + 0.01).map((r) => r.id);
  return judge({ elimination: { errors: lowered.feasible ? [] : ['composition impossible dans un format'], layout: [], unread, missingMedia: [] }, composition, motion, assertions, weights: judgeWeights() });
}
