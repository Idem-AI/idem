/**
 * LE CHEMIN DU FILM (24/11/2026) — les scènes choisies ENSEMBLE, plus une par une.
 *
 * Avant : chaque scène tirait son candidat en ne regardant que la précédente (−0,6 pour la même mise en page), puis des
 * passes correctives réparaient après coup. Chaque scène était bonne seule ; rien ne garantissait le film. C'est la mise
 * en garde des travaux de montage automatique (Leake et al., SIGGRAPH 2017 : les règles de montage — « idiomes » —
 * deviennent des coûts combinés dans UNE optimisation ; EditIQ, IUI 2025 : choix des plans par minimisation d'énergie ;
 * montage de concerts, 2026 : juger la séquence entière, pas chaque plan).
 *
 *   énergie du film = Σ coût de chaque scène (− son score du graphe) + Σ coût de chaque enchaînement (`pairCost`)
 *                     + usure (une même mise en page revenue dans le film)
 *
 * Programmation dynamique sur la chaîne des scènes (Viterbi). Pour garder la VARIÉTÉ d'un film à l'autre, le chemin
 * n'est pas le seul meilleur : il est TIRÉ selon sa probabilité exp(−énergie / température) — filtrage avant,
 * échantillonnage arrière (« forward filtering, backward sampling ») — avec la graine du film (rejouable). Les candidats
 * trop loin du meilleur de leur scène (`band`) sont écartés d'avance : jamais une scène nettement moins juste.
 *
 * 10 scènes × 12 candidats : 1 440 enchaînements évalués, moins d'une milliseconde. Aucun modèle.
 */
import { stableHash } from './graph';

export interface PathCandidate {
  layout: string;
  gabarit?: string;
  /** L'animation de titre de la recette (si elle en nomme une). */
  title?: string;
  /** La façon dont la mise en page montre son média. */
  cover: 'full' | 'part' | 'none';
  /** La séquence à laquelle appartient le candidat (scènes enchaînées : leur continuité est voulue). */
  sequence?: string;
  /** Le score du graphe (plus haut = plus juste). */
  score: number;
}

/** Le coût d'un enchaînement de deux scènes (les « idiomes » du montage, en coûts). */
export function pairCost(a: PathCandidate, b: PathCandidate): number {
  if (a.sequence && a.sequence === b.sequence) return 0;
  let c = 0;
  if (a.layout === b.layout) c += 0.6;
  if (a.gabarit && a.gabarit === b.gabarit) c += 0.25;
  if (a.title && a.title === b.title) c += 0.15;
  // Deux images plein cadre de suite passent ; deux scènes de texte seul de suite font diaporama.
  if (a.cover === 'full' && b.cover === 'full') c += 0.06;
  if (a.cover === 'none' && b.cover === 'none') c += 0.08;
  return c;
}

const jitter = (seed: string): number => (parseInt(stableHash([seed], 8), 16) % 1_000_000) / 1_000_000;

const logSumExp = (xs: number[]): number => {
  const m = Math.max(...xs);
  return m === -Infinity ? -Infinity : m + Math.log(xs.reduce((n, x) => n + Math.exp(x - m), 0));
};

/** L'usure : une mise en page déjà présente ailleurs dans le film (pas seulement juste avant). */
const WEAR = 0.12;

export interface PathOptions {
  seed: string;
  /** Température : plus petite = plus fidèle au meilleur chemin. */
  temp?: number;
  /** Écart de score au meilleur de la scène au-delà duquel un candidat est écarté. */
  band?: number;
  /** `best` : le meilleur chemin (contrôles) ; `sample` (défaut) : un chemin tiré. */
  mode?: 'best' | 'sample';
}

/**
 * Le chemin du film : l'indice du candidat retenu pour chaque scène. Deux passes : un premier chemin, puis un second
 * où une mise en page déjà employée ailleurs dans le film coûte un peu plus (l'usure n'est pas un coût entre voisins :
 * la programmation dynamique ne la voit pas seule).
 */
export function choosePath(lists: PathCandidate[][], o: PathOptions): number[] {
  if (!lists.length) return [];
  const temp = o.temp ?? 0.14;
  const band = o.band ?? 0.3;
  // Les candidats admis de chaque scène (indices dans sa liste).
  const admitted = lists.map((list) => {
    const top = Math.max(...list.map((c) => c.score));
    const ok = list.map((c, k) => (c.score >= top - band ? k : -1)).filter((k) => k >= 0);
    return ok.length ? ok : [0];
  });
  // L'usure s'ACCUMULE d'un passage à l'autre (sinon le second passage, libéré d'une répétition, en fait une autre) ; le
  // chemin gardé est celui dont l'énergie VRAIE (usure comprise) est la plus basse — chaque passage reste un tirage.
  const wear = new Map<string, number>();
  let kept: number[] = [];
  let keptE = Infinity;
  for (let round = 0; round < 3; round++) {
    const path = run(lists, admitted, wear, temp, o, round);
    const e = pathEnergy(lists, path);
    if (e < keptE - 1e-9) (kept = path), (keptE = e);
    const count = new Map<string, number>();
    path.forEach((k, i) => count.set(lists[i][k].layout, (count.get(lists[i][k].layout) ?? 0) + 1));
    const repeated = [...count].filter(([, n]) => n > 1);
    if (!repeated.length) break;
    for (const [id, n] of repeated) wear.set(id, Math.max(wear.get(id) ?? 0, (n - 1) * WEAR));
  }
  return kept;
}

function run(lists: PathCandidate[][], admitted: number[][], wear: Map<string, number>, temp: number, o: PathOptions, round: number): number[] {
  const n = lists.length;
  const unary = (i: number, k: number) => -lists[i][k].score + (lists[i][k].sequence ? 0 : wear.get(lists[i][k].layout) ?? 0);
  const best = o.mode === 'best';
  // α[i][j] : (log-)poids de tous les chemins qui finissent sur le candidat j de la scène i — ou, en mode `best`, le
  // meilleur d'entre eux (Viterbi : max au lieu de somme).
  const alpha: number[][] = [];
  const back: number[][] = [];
  alpha[0] = admitted[0].map((k) => -unary(0, k) / temp);
  back[0] = admitted[0].map(() => -1);
  for (let i = 1; i < n; i++) {
    alpha[i] = [];
    back[i] = [];
    admitted[i].forEach((k, j) => {
      const into = admitted[i - 1].map((kp, jp) => alpha[i - 1][jp] - pairCost(lists[i - 1][kp], lists[i][k]) / temp);
      if (best) {
        let arg = 0;
        into.forEach((v, jp) => (v > into[arg] ? (arg = jp) : 0));
        alpha[i][j] = into[arg] - unary(i, k) / temp;
        back[i][j] = arg;
      } else alpha[i][j] = logSumExp(into) - unary(i, k) / temp;
    });
  }
  const draw = (weights: number[], seed: string): number => {
    if (best) {
      let arg = 0;
      weights.forEach((w, j) => (w > weights[arg] ? (arg = j) : 0));
      return arg;
    }
    const m = Math.max(...weights);
    const p = weights.map((w) => Math.exp(w - m));
    let r = jitter(seed) * p.reduce((a, b) => a + b, 0);
    for (let j = 0; j < p.length; j++) {
      r -= p[j];
      if (r <= 0) return j;
    }
    return p.length - 1;
  };
  const out: number[] = new Array(n);
  let j = draw(alpha[n - 1], `${o.seed}|path|${round}|${n - 1}`);
  out[n - 1] = admitted[n - 1][j];
  for (let i = n - 2; i >= 0; i--) {
    if (best) j = back[i + 1][j];
    else {
      const next = lists[i + 1][out[i + 1]];
      j = draw(admitted[i].map((k, jp) => alpha[i][jp] - pairCost(lists[i][k], next) / temp), `${o.seed}|path|${round}|${i}`);
    }
    out[i] = admitted[i][j];
  }
  return out;
}

/** L'énergie d'un chemin (contrôles : le chemin tiré reste proche du meilleur). */
export function pathEnergy(lists: PathCandidate[][], path: number[]): number {
  let e = 0;
  const count = new Map<string, number>();
  path.forEach((k, i) => {
    const c = lists[i][k];
    e -= c.score;
    if (i) e += pairCost(lists[i - 1][path[i - 1]], c);
    count.set(c.layout, (count.get(c.layout) ?? 0) + 1);
  });
  for (const n of count.values()) if (n > 1) e += (n - 1) * WEAR;
  return Math.round(e * 1000) / 1000;
}
