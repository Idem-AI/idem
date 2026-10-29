/**
 * LE JUGE — l'assemblage : élimination, score, rapport mesuré.
 *
 *   étage 1  éliminatoire : erreur d'exécution, texte coupé / chevauché / caché / illisible dans un format, média absent,
 *            texte retiré avant son temps de lecture (contrôle Chromium existant + piste) → la variante est écartée ;
 *   étages   composition, mouvement (mesures 0 → 1) et intention (part des assertions tenues), combinés par des POIDS
 *   2 à 4    étalonnés sur vos préférences (`fit.ts`) — explicable mesure par mesure, reproductible ;
 *   rapport  pour chaque mesure sous son seuil : l'élément, le format, la valeur, le seuil et le CORRECTIF que le code
 *            propose (un cran d'échelle, une autre variante, une zone calme…) — la correction part de là, jamais d'un
 *            « améliore ta scène ».
 *
 * Aucun modèle d'IA ici : un départage visuel (VLM) reste optionnel et ne décide jamais seul (moteur vidéo).
 */
import type { Assertion } from './motion';

/** Les poids par défaut (réglages de départ ; `judge-weights.json` les remplace une fois étalonnés). */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  alignment: 1.0,
  grid: 0.8,
  balance: 0.4,
  equilibrium: 0.3,
  density: 0.9,
  hierarchy: 1.1,
  mainScale: 1.2,
  breathing: 0.6,
  sizes: 0.5,
  clutter: 0.7,
  colors: 0.4,
  contrast: 1.4,
  eased: 0.6,
  simultaneity: 0.8,
  overlap: 0.7,
  trajectories: 1.2,
  jitter: 1.0,
  heldTitle: 0.8,
  variety: 0.6,
  onBeat: 0.4,
  signature: 0.3,
  intent: 1.5,
};

/** Seuil d'arrêt de l'échantillonnage : une variante au-dessus suffit (réglage de départ). */
export const GOOD_ENOUGH = 0.8;

export interface Elimination {
  /** Erreurs d'exécution, défauts d'affichage par format. */
  errors: string[];
  layout: string[];
  /** Textes retirés avant leur temps de lecture, médias absents. */
  unread: string[];
  missingMedia: string[];
}

export interface Judgment {
  eliminated: boolean;
  reasons: string[];
  /** Score 0 → 1 (moyenne pondérée des mesures et des assertions). */
  score: number;
  features: Record<string, number>;
  assertions: Assertion[];
  report: ReportLine[];
}

export interface ReportLine {
  metric: string;
  value: number;
  threshold: number;
  /** Élément et format en cause, quand on les connaît. */
  element?: string;
  format?: string;
  /** Le correctif proposé par le code (sans appel de modèle quand c'est possible). */
  fix: string;
  /** Un correctif applicable par le code (nouvelle résolution) : la variante à essayer. */
  choice?: Partial<{ typeStep: -1 | 0 | 1; scale: number; textZone: 'calm' | 'bottom' | 'top'; valign: 'center' | 'upper' | 'lower'; ratio: number; side: 'start' | 'end' }>;
}

const FIX: Record<string, { threshold: number; fix: string; choice?: ReportLine['choice'] }> = {
  mainScale: { threshold: 0.75, fix: 'agrandir l’élément principal d’un cran', choice: { typeStep: 1, scale: 1.15 } },
  hierarchy: { threshold: 0.6, fix: 'creuser l’écart titre / texte d’un cran', choice: { typeStep: 1 } },
  density: { threshold: 0.6, fix: 'alléger la scène (un cran de moins) ou rapprocher les éléments', choice: { typeStep: -1 } },
  breathing: { threshold: 0.5, fix: 'laisser du blanc autour de l’élément principal (autre position verticale)', choice: { valign: 'upper' } },
  contrast: { threshold: 0.7, fix: 'poser le texte dans une zone calme ou sur un aplat', choice: { textZone: 'bottom' } },
  clutter: { threshold: 0.5, fix: 'éloigner le texte des zones chargées de l’image', choice: { textZone: 'calm' } },
  alignment: { threshold: 0.6, fix: 'aligner les éléments sur un même bord ou un même axe' },
  grid: { threshold: 0.5, fix: 'caler les bords sur les colonnes', choice: { ratio: 0.5 } },
  balance: { threshold: 0.45, fix: 'rééquilibrer : passer le média de l’autre côté', choice: { side: 'end' } },
  trajectories: { threshold: 0.99, fix: 'retarder ou re-router l’entrée qui croise un texte' },
  jitter: { threshold: 0.99, fix: 'retirer la boucle d’attente : un titre posé ne bouge plus' },
  heldTitle: { threshold: 0.99, fix: 'laisser le titre immobile une fois posé, faire bouger la caméra ou l’élément suivant' },
  simultaneity: { threshold: 0.9, fix: 'échelonner les entrées (au plus deux mouvements principaux à la fois)' },
  overlap: { threshold: 0.6, fix: 'faire partir chaque entrée quand la précédente est faite à 30–50 %' },
  variety: { threshold: 0.6, fix: 'varier les entrées (pas tout en « monter et apparaître »)' },
  intent: { threshold: 0.99, fix: 'tenir l’ordre et les directions demandés par l’intention' },
};

/** Le jugement d'une variante. */
export function judge(input: { elimination: Elimination; composition: Record<string, number>[]; motion: Record<string, number>; assertions: Assertion[]; weights?: Record<string, number> }): Judgment {
  const reasons = [...input.elimination.errors, ...input.elimination.layout, ...input.elimination.unread.map((t) => `retiré avant d’être lu : ${t}`), ...input.elimination.missingMedia.map((m) => `média absent : ${m}`)];
  // La composition se juge dans CHAQUE format : on garde le pire format pour chaque mesure.
  const comp: Record<string, number> = {};
  for (const c of input.composition) for (const [k, v] of Object.entries(c)) comp[k] = Math.min(comp[k] ?? 1, v);
  const intentScore = input.assertions.length ? input.assertions.filter((a) => a.ok).length / input.assertions.length : 1;
  const features: Record<string, number> = { ...comp, ...input.motion, intent: intentScore };
  const weights = input.weights || DEFAULT_WEIGHTS;
  let num = 0;
  let den = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (features[k] === undefined || !Number.isFinite(features[k])) continue;
    num += w * features[k];
    den += Math.abs(w);
  }
  const score = den ? Math.max(0, Math.min(1, num / den)) : 0;
  const report: ReportLine[] = [];
  for (const [metric, rule] of Object.entries(FIX)) {
    const value = features[metric];
    if (value === undefined || value >= rule.threshold) continue;
    report.push({ metric, value: Math.round(value * 100) / 100, threshold: rule.threshold, fix: rule.fix, ...(rule.choice ? { choice: rule.choice } : {}) });
  }
  for (const a of input.assertions.filter((x) => !x.ok)) report.push({ metric: 'intent', value: 0, threshold: 1, element: a.name.split(' ')[0], fix: `assertion non tenue : ${a.name}` });
  report.sort((a, b) => (weights[b.metric] || 1) * (b.threshold - b.value) - (weights[a.metric] || 1) * (a.threshold - a.value));
  return { eliminated: reasons.length > 0, reasons, score: reasons.length ? 0 : Math.round(score * 1000) / 1000, features, assertions: input.assertions, report };
}

/** Le rapport en clair pour l'auteur (correction guidée par la mesure). */
export function reportText(j: Judgment, max = 5): string {
  const lines = [
    ...j.reasons.slice(0, max).map((r) => `- ÉLIMINATOIRE : ${r}`),
    ...j.report.slice(0, max).map((r) => `- ${r.metric} = ${r.value} (seuil ${r.threshold})${r.element ? ` sur ${r.element}` : ''}${r.format ? ` [${r.format}]` : ''} → ${r.fix}`),
  ];
  return lines.join('\n');
}
