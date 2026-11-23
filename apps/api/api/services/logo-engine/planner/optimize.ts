/**
 * L'AFFINEUR — chercher les bons réglages au lieu de les tirer au sort, sans un seul token.
 *
 * Le planificateur tire quelques paramètres au hasard dans leurs bornes : l'idée est juste, le
 * réglage rarement le meilleur (trait un peu maigre, pétales trop serrés, symbole trop petit face
 * au nom). L'affineur part de ce réglage et l'améliore par une stratégie d'évolution (1+1) à pas
 * adaptatif (règle du 1/5) : il modifie un ou deux paramètres numériques, reconstruit, MESURE la
 * note perceptive du type, et ne garde que ce qui l'améliore. Graine fixe : même entrée, même
 * résultat.
 *
 * Ce qu'il ne touche jamais : le type, les motifs, les couleurs, le texte — et l'ordre d'une
 * symétrie déclarée (on ne transforme pas un D6 en D5). Le résultat repasse par le pipeline
 * qualité complet ; s'il est moins bien classé que l'original, on garde l'original.
 */
import type { LogoDocument } from '../ir/logo.schema';
import { walkLayers } from '../ir/logo.schema';
import { produceLogo } from '../pipeline';
import type { ProducedLogo } from '../pipeline';
import { buildLogo } from '../render/build';
import type { BuildOptions } from '../render/build';
import { getGenerator, seeded } from '../render/generators';
import { perceiveLogo, rankScore } from '../validate/perception';

interface Tunable {
  key: string;
  min: number;
  max: number;
  int: boolean;
  get(): number;
  set(v: number): void;
}

/** Les réglages numériques d'un document, liés à CE document (à appeler sur une copie). */
export function tunablesOf(doc: LogoDocument): Tunable[] {
  const out: Tunable[] = [];
  const lockedOrder = !!doc.concept.symmetry && doc.concept.symmetry !== 'none';
  walkLayers(doc.layers, (layer) => {
    if (layer.hidden) return;
    if (layer.kind === 'generator') {
      const spec = getGenerator(layer.generator);
      if (!spec) return;
      for (const [key, def] of Object.entries(spec.params)) {
        if (def.kind !== 'num') continue;
        out.push({
          key: `${layer.id}.${key}`,
          min: def.min,
          max: def.max,
          int: !!def.int,
          get: () => (typeof layer.params[key] === 'number' ? (layer.params[key] as number) : def.def),
          set: (v) => {
            layer.params[key] = v;
          },
        });
      }
    } else if (layer.kind === 'repeat') {
      if (!lockedOrder) out.push({ key: `${layer.id}.count`, min: 2, max: 12, int: true, get: () => layer.count, set: (v) => (layer.count = v) });
      out.push({ key: `${layer.id}.radius`, min: 0, max: 40, int: false, get: () => layer.radius, set: (v) => (layer.radius = v) });
    }
  });
  const hasSymbolAndName = doc.composition.layout !== 'symbol-only' && doc.composition.layout !== 'wordmark-only';
  if (hasSymbolAndName) {
    out.push({ key: 'composition.gap', min: 0.15, max: 0.6, int: false, get: () => doc.composition.gap, set: (v) => (doc.composition.gap = v) });
    out.push({ key: 'composition.symbolScale', min: 1.6, max: 4.2, int: false, get: () => doc.composition.symbolScale ?? 2.7, set: (v) => (doc.composition.symbolScale = v) });
  }
  return out;
}

/** Gaussienne de Box-Muller sur un générateur à graine. */
const gauss = (rng: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());

export interface RefineResult {
  logo: ProducedLogo;
  /** Évaluations faites, et note perceptive avant → après. */
  evaluations: number;
  from: number;
  to: number;
  changed: string[];
}

/** Note perceptive rapide (construction + perception, sans le rapport complet). */
async function quickAesthetic(doc: unknown, build: BuildOptions): Promise<number | null> {
  const made = await buildLogo(doc, build);
  if (!made.ok || !made.session || !made.rendered) return null;
  return (await perceiveLogo(made.session, made.rendered)).score;
}

export async function refineLogo(start: ProducedLogo, build: BuildOptions, budget = 8): Promise<RefineResult> {
  const from = start.report.aesthetic ?? 0;
  const base = { logo: start, evaluations: 0, from, to: from, changed: [] as string[] };
  if (budget <= 0) return base;
  const rng = seeded((start.doc.meta.seed ^ 0x9e3779b9) >>> 0);
  let best: LogoDocument = structuredClone(start.doc);
  let bestScore = from;
  let sigma = 0.18;
  let successes = 0;
  const changed = new Set<string>();
  let evaluations = 0;
  for (let step = 0; step < budget; step++) {
    const candidate = structuredClone(best);
    const tunables = tunablesOf(candidate);
    if (!tunables.length) break;
    const moves = 1 + (rng() < 0.35 ? 1 : 0);
    const touched: string[] = [];
    for (let m = 0; m < moves; m++) {
      const t = tunables[Math.floor(rng() * tunables.length)];
      const span = t.max - t.min;
      let next = Math.min(t.max, Math.max(t.min, t.get() + gauss(rng) * sigma * span));
      next = t.int ? Math.round(next) : Math.round(next * 100) / 100;
      if (next === t.get()) continue;
      t.set(next);
      touched.push(t.key);
    }
    if (!touched.length) continue;
    evaluations++;
    const score = await quickAesthetic(candidate, build);
    if (score !== null && score > bestScore) {
      best = candidate;
      bestScore = score;
      successes++;
      touched.forEach((k) => changed.add(k));
    }
    // Règle du 1/5 : le pas s'élargit quand ça réussit, se resserre sinon.
    if ((step + 1) % 4 === 0) {
      sigma = successes / 4 > 0.2 ? Math.min(0.4, sigma * 1.5) : Math.max(0.04, sigma * 0.6);
      successes = 0;
    }
  }
  if (!changed.size) return { ...base, evaluations };
  const final = await produceLogo(best, build, { skipVariants: true });
  if (!final.ok || !final.logo || !final.logo.fingerprint) return { ...base, evaluations };
  // Jamais moins bien classé, jamais moins exploitable.
  if (rankScore(final.logo.report) <= rankScore(start.report) || (start.report.accepted && !final.logo.report.accepted)) return { ...base, evaluations };
  return { logo: final.logo, evaluations, from, to: final.logo.report.aesthetic ?? bestScore, changed: [...changed] };
}
