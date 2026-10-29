/**
 * `npm run bench:quality:fit --prefix packages/motion-compiler [-- --baseline baseline --candidate intent --write]`
 *
 * L'ÉTALONNAGE DU JUGE ET LES CRITÈRES DE PASSAGE DU PLAN — sans modèle :
 *
 *   1. les votes des évaluateurs (`bench/out/quality/votes/*.json`) donnent, pour chaque paire, la préférence du panel
 *      (majorité ; égalité si partagé) ;
 *   2. l'ACCORD du juge actuel avec le panel (score moyen des scènes de chaque vidéo) — phase 0 : au moins 65 % ;
 *   3. la régression logistique sur les mesures (Bradley-Terry) donne de nouveaux poids ; `--write` les écrit dans
 *      `packages/motion-compiler/judge-weights.json` (lu par le moteur au démarrage) ;
 *   4. les critères de passage de chaque phase, calculés sur les résultats du banc.
 *
 * Une part du banc reste notée par des humains à CHAQUE version du juge : on ne doit pas optimiser la mesure au lieu
 * de la vidéo.
 */
import fs from 'fs';
import path from 'path';
import { agreement, DEFAULT_WEIGHTS, fitWeights, linearScore, PairVote } from '../../src/judge';
import type { QualityResult } from './run';

const OUT = path.join(__dirname, '../out/quality');
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const BASELINE = arg('baseline', 'baseline');
const CANDIDATE = arg('candidate', 'intent');

interface VoteFile {
  rater: string;
  votes: { pair: string; a: string; b: string; winner: string }[];
}

/** Les mesures moyennes d'une vidéo (scènes qui en ont). */
export function videoFeatures(r: QualityResult): Record<string, number> | null {
  const scenes = r.scenes.filter((s) => s.features);
  if (!scenes.length) return null;
  const keys = [...new Set(scenes.flatMap((s) => Object.keys(s.features!)))];
  return Object.fromEntries(keys.map((k) => [k, scenes.reduce((a, s) => a + (s.features![k] ?? 0), 0) / scenes.length]));
}

const meanScore = (r: QualityResult) => {
  const s = r.scenes.filter((x) => typeof x.score === 'number');
  return s.length ? s.reduce((a, x) => a + x.score!, 0) / s.length : null;
};

const pct = (n: number) => `${Math.round(n * 100)} %`;

if (require.main === module) {
  const results = JSON.parse(fs.readFileSync(path.join(OUT, 'results.json'), 'utf8')) as Record<string, QualityResult>;
  const voteDir = path.join(OUT, 'votes');
  const files = fs.existsSync(voteDir) ? fs.readdirSync(voteDir).filter((f) => f.endsWith('.json')) : [];
  const tallies = new Map<string, { a: string; b: string; wa: number; wb: number; ties: number }>();
  for (const f of files) {
    const v = JSON.parse(fs.readFileSync(path.join(voteDir, f), 'utf8')) as VoteFile;
    for (const x of v.votes) {
      const t = tallies.get(x.pair) || { a: x.a, b: x.b, wa: 0, wb: 0, ties: 0 };
      if (x.winner === x.a) t.wa++;
      else if (x.winner === x.b) t.wb++;
      else t.ties++;
      tallies.set(x.pair, t);
    }
  }
  const humanPairs = [...tallies.values()].map((t) => ({ ...t, y: t.wa > t.wb ? 1 : t.wb > t.wa ? 0 : 0.5 }));
  console.log(`Banc qualité — ${Object.keys(results).length} vidéos, ${files.length} évaluateur(s), ${humanPairs.length} paires votées\n`);

  // Phase 0 : l'accord du juge actuel (score moyen des scènes) avec le panel.
  const scored = humanPairs.filter((p) => p.y !== 0.5 && meanScore(results[p.a]) !== null && meanScore(results[p.b]) !== null);
  const agree0 = scored.length ? scored.filter((p) => (meanScore(results[p.a])! > meanScore(results[p.b])! ? 1 : 0) === p.y).length / scored.length : 0;
  console.log(`Phase 0 · accord du juge avec le panel : ${pct(agree0)} sur ${scored.length} paires décidées (passage : ≥ 65 %) ${agree0 >= 0.65 ? '✓' : '✗'}`);

  // L'étalonnage : régression logistique sur la différence des mesures.
  const featured: PairVote[] = humanPairs.map((p) => ({ a: videoFeatures(results[p.a])!, b: videoFeatures(results[p.b])!, y: p.y })).filter((p) => p.a && p.b);
  if (featured.length >= 20) {
    const before = agreement(featured, (f) => linearScore(f, DEFAULT_WEIGHTS));
    const fit = fitWeights(featured, DEFAULT_WEIGHTS);
    const after = agreement(featured, (f) => linearScore(f, fit.weights));
    console.log(`Étalonnage : ${featured.length} paires mesurées · accord ${pct(before)} → ${pct(after)} (perte ${fit.loss.toFixed(3)})`);
    if (process.argv.includes('--write')) {
      const dest = path.join(__dirname, '../../judge-weights.json');
      fs.writeFileSync(dest, JSON.stringify({ fittedAt: new Date().toISOString(), pairs: featured.length, raters: files.length, agreementBefore: before, agreementAfter: after, weights: fit.weights }, null, 2));
      console.log(`Poids écrits : ${dest}`);
    }
  } else console.log(`Étalonnage : ${featured.length} paires mesurées (il en faut au moins 20)`);

  // Les critères de passage des phases suivantes.
  const of = (label: string) => Object.values(results).filter((r) => r.label === label);
  const base = of(BASELINE);
  const cand = of(CANDIDATE);
  const versus = (labelA: string, levelA: string | null, labelB: string, levelB: string | null) => {
    const ps = humanPairs.filter((p) => {
      const ra = results[p.a];
      const rb = results[p.b];
      const match = (r: QualityResult, l: string, lv: string | null) => r.label === l && (!lv || r.level === lv);
      return (match(ra, labelA, levelA) && match(rb, labelB, levelB)) || (match(rb, labelA, levelA) && match(ra, labelB, levelB));
    });
    const wins = ps.reduce((a, p) => a + (results[p.a].label === labelA ? p.y : 1 - p.y), 0);
    return { n: ps.length, rate: ps.length ? wins / ps.length : 0 };
  };
  const sameLevel = ['low', 'medium', 'high', 'ultra'].map((lv) => versus(CANDIDATE, lv, BASELINE, lv)).reduce((a, x) => ({ n: a.n + x.n, rate: a.n + x.n ? (a.rate * a.n + x.rate * x.n) / (a.n + x.n) : 0 }), { n: 0, rate: 0 });
  const okRate = (rs: QualityResult[]) => (rs.length ? rs.filter((r) => r.ok).length / rs.length : 0);
  console.log(`Phase 1 · ${CANDIDATE} gagne ${pct(sameLevel.rate)} des paires contre ${BASELINE} au même cran (${sameLevel.n} paires ; passage ≥ 60 %, sans régression technique : ${pct(okRate(cand))} livrées contre ${pct(okRate(base))}) ${sameLevel.rate >= 0.6 && okRate(cand) >= okRate(base) ? '✓' : '✗'}`);
  const freeNumbers = cand.filter((r) => r.level === 'low').flatMap((r) => r.scenes).filter((s) => !s.features).length;
  console.log(`Phase 2 · au cran Low, scènes écrites sans nombre libre (intention) : ${cand.filter((r) => r.level === 'low').flatMap((r) => r.scenes).length - freeNumbers}/${cand.filter((r) => r.level === 'low').flatMap((r) => r.scenes).length} ${freeNumbers === 0 ? '✓' : '✗'}`);
  const sum = (rs: QualityResult[], k: 'inkFallbacks' | 'firstPassLayout') => rs.reduce((a, r) => a + (r[k] || 0), 0);
  const ink = [sum(base, 'inkFallbacks'), sum(cand, 'inkFallbacks')];
  const first = [sum(base, 'firstPassLayout'), sum(cand, 'firstPassLayout')];
  console.log(`Phase 3 · recours à l’aplat ${ink[0]} → ${ink[1]} (passage : ÷ 4) ${ink[1] * 4 <= ink[0] ? '✓' : '✗'} · défauts d’affichage au premier jet ${first[0]} → ${first[1]} (passage : ÷ 2) ${first[1] * 2 <= first[0] ? '✓' : '✗'}`);
  const lowHigh = versus(CANDIDATE, 'low', BASELINE, 'high');
  console.log(`Phase 4 · ${CANDIDATE} Low contre ${BASELINE} High : ${pct(lowHigh.rate)} des paires (${lowHigh.n} ; passage ≥ 50 %) ${lowHigh.n && lowHigh.rate >= 0.5 ? '✓' : '✗'}`);
  const cost = (rs: QualityResult[]) => rs.reduce((a, r) => a + r.usage.cost, 0);
  console.log(`\nCoût du banc : ${BASELINE} ${cost(base).toFixed(3)} $ · ${CANDIDATE} ${cost(cand).toFixed(3)} $ · fournisseurs servis : ${JSON.stringify(cand.reduce<Record<string, number>>((a, r) => { for (const [p, n] of Object.entries(r.usage.providers)) a[p] = (a[p] || 0) + n; return a; }, {}))}`);
  console.log('Phase 5 · préférence stable d’une version à l’autre : comparer ce rapport à celui de la version précédente ; directions jamais répétées : `video.created`/`film.direction.repeatedAvoided` dans les journaux de production.');
}
