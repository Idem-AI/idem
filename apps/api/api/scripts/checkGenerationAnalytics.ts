/**
 * CONTRÔLE DU COÛT PAR RÉSULTAT ACCEPTÉ et du CLASSEMENT QUI APPREND.
 *
 *   npx ts-node --transpile-only api/scripts/checkGenerationAnalytics.ts
 *
 * Aucun appel de modèle, aucune base : des enregistrements fabriqués ici, pour vérifier que les deux services
 * disent ce qu'ils promettent — en particulier qu'un modèle bon marché qui rate coûte plus cher qu'un modèle
 * cher qui réussit, et qu'un nœud neuf n'est jamais puni d'être neuf.
 */
import type { GenerationRecord } from '@idem/graphic-engine';
import { compare, metricsBy, metricsOf } from '../services/graphic/generation-analytics.service';
import { MIN_USES, MAX_WEIGHT, MIN_WEIGHT, mergeWeights, weightOf } from '../services/graphic/catalog-performance.service';

let failures = 0;
const ok = (what: string, pass: boolean, detail = ''): void => {
  console.log(`  ${pass ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures += 1;
};

function record(o: { deliverable?: string; level?: GenerationRecord['level']; model?: string; input?: number; output?: number; repairs?: number; blocking?: number; ms?: number; templates?: GenerationRecord['templates'] }): GenerationRecord {
  const input = o.input ?? 10_000;
  const output = o.output ?? 2_000;
  return {
    v: 1,
    deliverable: o.deliverable ?? 'pitch-deck',
    level: o.level ?? 'medium',
    createdAt: new Date().toISOString(),
    decisions: [{ task: 'catalog.choose', source: 'llm', role: 'graphic.template', model: o.model ?? 'qwen/qwen3.5-9b', tokens: { input, output }, ms: 800, outcome: 'accepted' }],
    assets: [],
    repairs: Array.from({ length: o.repairs ?? 0 }, (_, i) => ({ code: 'zone_fit', detail: `z${i}`, by: 'code' as const })),
    fallbacks: [],
    issues: { blocking: Array.from({ length: o.blocking ?? 0 }, (_, i) => `p${i}: cut`), advisory: [] },
    templates: o.templates ?? [],
    tokens: { input, output },
    ms: o.ms ?? 1_000,
  };
}

console.log('\n§1 Les mesures d’un lot');
const lot = [record({ ms: 1000 }), record({ ms: 2000, repairs: 2 }), record({ ms: 9000, blocking: 1 })];
const m = metricsOf(lot);
ok('trois générations, deux acceptées', m.generations === 3 && m.accepted === 2, `${m.accepted}/3`);
ok('une seule du premier jet (ni réparation ni constat)', m.firstPass === 1, String(m.firstPass));
ok('la médiane ignore la génération qui a dérapé', m.msMedian === 2000, `${m.msMedian} ms`);
ok('le coût par acceptée est supérieur au coût par génération', m.costPerAcceptedUsd > m.costUsd / 3, `${m.costPerAcceptedUsd} $`);
ok('un lot vide ne divise pas par zéro', metricsOf([]).costPerAcceptedUsd === 0 && metricsOf([]).acceptanceRate === 0);

console.log('\n§2 Le point de bascule entre un petit modèle et un gros');
// Le petit modèle est ~9 fois moins cher à l'appel : il peut rater plusieurs fois et rester gagnant.
// C'est précisément ce que la mesure sert à TROUVER — le seuil, pas l'intuition.
// Deux modèles RÉELS de la liste blanche, à des tarifs différents (`config/openrouter.config.ts`).
const SMALL = 'qwen/qwen3.5-9b';
const BIG = 'qwen/qwen3.5-397b-a17b';
const cheap = [record({ model: SMALL, blocking: 1 }), record({ model: SMALL, blocking: 1 }), record({ model: SMALL })];
const strong = [record({ model: BIG })];
const c = metricsOf(cheap);
const s = metricsOf(strong);
ok('le petit modèle coûte moins cher par APPEL', c.costUsd / c.generations < s.costUsd / s.generations, `${(c.costUsd / 3).toFixed(5)} $ contre ${s.costUsd.toFixed(5)} $`);
ok('avec deux échecs sur trois, il reste gagnant par RÉSULTAT ACCEPTÉ', c.costPerAcceptedUsd < s.costPerAcceptedUsd, `${c.costPerAcceptedUsd} $ contre ${s.costPerAcceptedUsd} $`);
// Le seuil : à partir de combien d'échecs le petit modèle devient-il plus cher que le gros ?
const flip = (() => {
  for (let fails = 1; fails <= 40; fails += 1) {
    const lotCheap = [...Array.from({ length: fails }, () => record({ model: SMALL, blocking: 1 })), record({ model: SMALL })];
    if (metricsOf(lotCheap).costPerAcceptedUsd > s.costPerAcceptedUsd) return fails;
  }
  return 0;
})();
ok('la mesure trouve le seuil de bascule', flip > 0, `${flip} échecs pour une réussite : au-delà, le gros modèle revient moins cher`);

console.log('\n§3 La comparaison avant / après');
const before = [record({ repairs: 1 }), record({ blocking: 1 })];
const after = [record({}), record({})];
const cmp = compare(before, after);
ok('un moteur qui accepte plus et coûte moins est dit meilleur', cmp.better, `Δ coût/acceptée ${cmp.deltas.costPerAcceptedUsd} $, Δ acceptation ${cmp.deltas.acceptanceRate}`);
ok('le contraire est dit moins bon', !compare(after, before).better);
ok('le regroupement par livrable sépare les lots', Object.keys(metricsBy([record({ deliverable: 'business-plan' }), record({ deliverable: 'pitch-deck' })], (r) => r.deliverable)).length === 2);

console.log('\n§4 Le classement qui apprend');
ok(`un nœud neuf garde le poids 1 (moins de ${MIN_USES} usages)`, weightOf({ uses: MIN_USES - 1, repairs: 5, blocking: 3 }) === 1);
ok('un nœud qui tient bien est favorisé', weightOf({ uses: 100, repairs: 2, blocking: 0 }) > 1, String(weightOf({ uses: 100, repairs: 2, blocking: 0 })));
ok('un nœud qui casse recule', weightOf({ uses: 100, repairs: 40, blocking: 20 }) < 1, String(weightOf({ uses: 100, repairs: 40, blocking: 20 })));
ok('le poids reste borné', weightOf({ uses: 500, repairs: 0, blocking: 0 }) <= MAX_WEIGHT && weightOf({ uses: 500, repairs: 500, blocking: 500 }) >= MIN_WEIGHT);
ok('aucun nœud n’est écarté par la mesure (poids jamais nul)', weightOf({ uses: 500, repairs: 500, blocking: 500 }) > 0);
const merged = mergeWeights({ 'layout.a': 2 }, { 'layout.a': 0.8, 'layout.b': 1.2 });
ok('la main de l’équipe multiplie la mesure', merged['layout.a'] === 1.6 && merged['layout.b'] === 1.2, JSON.stringify(merged));
ok('un poids manuel sur un nœud jamais mesuré passe tel quel', mergeWeights({ 'layout.c': 0.5 }, {})['layout.c'] === 0.5);

console.log(`\n${failures ? '✗' : '✓'} ${failures} échec(s)\n`);
process.exit(failures ? 1 : 0);
