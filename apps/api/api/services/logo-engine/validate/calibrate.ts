/**
 * Ajustement des poids d'un profil perceptif sur des jugements humains par paires (Bradley–Terry).
 * Utilisé par `npm run calibrate:logo -- fit`.
 */
import type { ConceptType } from '../ir/logo.schema';
import type { PerceptKey } from './perception';

export interface Judged {
  type: ConceptType;
  a: Partial<Record<PerceptKey, number>>;
  b: Partial<Record<PerceptKey, number>>;
  winner: 'a' | 'b';
}

/** Bradley–Terry par type : poids ≥ 0, rappel L2 vers les poids raisonnés, normalisés à 1. */
export function fitWeights(judged: Judged[], prior: Partial<Record<PerceptKey, number>>): { weights: Record<string, number>; before: number; after: number } {
  const keys = Object.keys(prior) as PerceptKey[];
  const x = judged.map((j) => keys.map((k) => (j.a[k] ?? 0.5) - (j.b[k] ?? 0.5)));
  const y = judged.map((j) => (j.winner === 'a' ? 1 : -1));
  const w0 = keys.map((k) => prior[k] ?? 0);
  const w = [...w0];
  const accuracy = (v: number[]) => x.filter((row, i) => Math.sign(row.reduce((s, xi, k) => s + xi * v[k], 0)) === y[i]).length / Math.max(1, x.length);
  const lambda = 0.05;
  for (let it = 0; it < 3000; it++) {
    const grad = w.map((wk, k) => 2 * lambda * (wk - w0[k]));
    x.forEach((row, i) => {
      const margin = y[i] * row.reduce((s, xi, k) => s + xi * w[k], 0);
      const g = -y[i] / (1 + Math.exp(margin));
      row.forEach((xi, k) => (grad[k] += (g * xi) / x.length));
    });
    for (let k = 0; k < w.length; k++) w[k] = Math.max(0, w[k] - 0.5 * grad[k]);
  }
  const total = w.reduce((s, v) => s + v, 0) || 1;
  const weights: Record<string, number> = {};
  keys.forEach((k, i) => (weights[k] = Math.round((w[i] / total) * 1000) / 1000));
  return { weights, before: accuracy(w0), after: accuracy(w) };
}

