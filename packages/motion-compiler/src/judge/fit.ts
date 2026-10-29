/**
 * L'ÉTALONNAGE DU JUGE SUR VOS PRÉFÉRENCES — sans modèle d'IA.
 *
 * L'équipe compare des paires de vidéos à l'aveugle (« A est meilleure que B », ou égalité). Une régression logistique
 * sur la DIFFÉRENCE des mesures (modèle de Bradley-Terry) donne les poids : P(A ≻ B) = σ(w · (fA − fB)). Les poids
 * restent lisibles mesure par mesure ; `agreement` dit sur quelle part des paires le juge choisit comme les humains
 * (le passage de la phase 0 demande au moins 65 %).
 */

export interface PairVote {
  a: Record<string, number>;
  b: Record<string, number>;
  /** 1 : A préférée ; 0 : B préférée ; 0,5 : égalité. */
  y: number;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Ajuste les poids (descente de gradient, régularisation L2 vers les poids de départ). */
export function fitWeights(pairs: PairVote[], start: Record<string, number>, opts: { epochs?: number; rate?: number; l2?: number } = {}): { weights: Record<string, number>; loss: number } {
  const keys = Object.keys(start);
  const w = keys.map((k) => start[k]);
  const prior = [...w];
  const epochs = opts.epochs ?? 600;
  const rate = opts.rate ?? 0.05;
  const l2 = opts.l2 ?? 0.02;
  const rows = pairs.map((p) => ({ x: keys.map((k) => (p.a[k] ?? 0.5) - (p.b[k] ?? 0.5)), y: p.y }));
  let loss = 0;
  for (let e = 0; e < epochs; e++) {
    const grad = new Array(keys.length).fill(0);
    loss = 0;
    for (const r of rows) {
      const p = sigmoid(r.x.reduce((a, x, i) => a + x * w[i], 0));
      loss += -(r.y * Math.log(p + 1e-9) + (1 - r.y) * Math.log(1 - p + 1e-9));
      r.x.forEach((x, i) => (grad[i] += (p - r.y) * x));
    }
    for (let i = 0; i < w.length; i++) w[i] -= rate * (grad[i] / Math.max(1, rows.length) + l2 * (w[i] - prior[i]));
  }
  return { weights: Object.fromEntries(keys.map((k, i) => [k, Math.round(w[i] * 1000) / 1000])), loss: rows.length ? loss / rows.length : 0 };
}

/** La part des paires (hors égalités) où le score du juge choisit comme les humains. */
export function agreement(pairs: PairVote[], score: (features: Record<string, number>) => number): number {
  const decided = pairs.filter((p) => p.y !== 0.5);
  if (!decided.length) return 0;
  return decided.filter((p) => (score(p.a) > score(p.b) ? 1 : 0) === p.y).length / decided.length;
}

/** Le score linéaire d'un jeu de poids (mêmes conventions que `judge`). */
export function linearScore(features: Record<string, number>, weights: Record<string, number>): number {
  let num = 0;
  let den = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (features[k] === undefined) continue;
    num += w * features[k];
    den += Math.abs(w);
  }
  return den ? num / den : 0;
}
