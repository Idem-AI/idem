/**
 * LE FILM, À SON ÉCHELLE — ce que le code planifie entre les scènes, sans modèle :
 *
 *   squelette  les huit temps d'une vidéo produit (banc Code2Video de HeyGen) : accroche, problème, présentation,
 *              fonction clé, bénéfices, preuve sociale, appel à l'action, signature — donnés au planificateur ;
 *   énergie    une courbe 1 → 5 par scène (celle du directeur, sinon celle des rôles) ; un seul pic ;
 *   coutures   la loi vectorielle (HyperFrames « motion doctrine », Apache-2.0) : une direction dominante pour les
 *              coutures ordinaires, des vecteurs RÉSERVÉS au sens (vers le haut : une conclusion qui s'élève ;
 *              zoom inverse : l'arrivée du moment fort), jamais deux coutures consécutives en sens opposés, 3 à 5
 *              sortes par film, au plus un tiers de coupes franches ;
 *   sons       environ une transition sur deux reçoit un effet, varié, calé pour que son pic tombe sur la coupe ;
 *              montée puis impact une seule fois, sur le moment fort.
 */
import type { Direction4, FilmDesign, SeamKind, SeamSpec } from './types';
import { clampEnergy } from './motion';

export type SceneRole = 'hook' | 'problem' | 'reveal' | 'feature' | 'benefits' | 'proof' | 'cta' | 'signature' | 'statement' | 'data' | 'chapter';
export const SCENE_ROLES: SceneRole[] = ['hook', 'problem', 'reveal', 'feature', 'benefits', 'proof', 'cta', 'signature', 'statement', 'data', 'chapter'];

/** Les huit temps d'une vidéo produit, dans l'ordre, avec leur part indicative de la durée. */
export const PRODUCT_SKELETON: { role: SceneRole; fr: string; en: string; share: number }[] = [
  { role: 'hook', fr: 'accroche', en: 'hook', share: 0.1 },
  { role: 'problem', fr: 'problème', en: 'problem', share: 0.12 },
  { role: 'reveal', fr: 'présentation', en: 'reveal', share: 0.1 },
  { role: 'feature', fr: 'fonction clé', en: 'key feature', share: 0.18 },
  { role: 'benefits', fr: 'bénéfices', en: 'benefits', share: 0.16 },
  { role: 'proof', fr: 'preuve sociale', en: 'social proof', share: 0.14 },
  { role: 'cta', fr: 'appel à l’action', en: 'call to action', share: 0.1 },
  { role: 'signature', fr: 'signature', en: 'signature', share: 0.1 },
];

export function roleOf(raw: unknown): SceneRole | undefined {
  const k = String(raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const table: Record<string, SceneRole> = {
    hook: 'hook', accroche: 'hook', opening: 'hook', intro: 'hook',
    problem: 'problem', probleme: 'problem', tension: 'problem', pain: 'problem',
    reveal: 'reveal', presentation: 'reveal', introduction: 'reveal', product: 'reveal',
    feature: 'feature', fonction: 'feature', fonctioncle: 'feature', keyfeature: 'feature', demo: 'feature',
    benefits: 'benefits', benefit: 'benefits', benefices: 'benefits', avantages: 'benefits',
    proof: 'proof', socialproof: 'proof', preuve: 'proof', preuvesociale: 'proof', testimonial: 'proof', temoignage: 'proof',
    cta: 'cta', calltoaction: 'cta', appelalaction: 'cta', action: 'cta', offer: 'cta', offre: 'cta',
    signature: 'signature', endcard: 'signature', outro: 'signature', logo: 'signature', brand: 'signature',
    statement: 'statement', claim: 'statement', message: 'statement', payoff: 'statement',
    data: 'data', figure: 'data', number: 'data', chiffre: 'data', stat: 'data',
    chapter: 'chapter', chapitre: 'chapter',
  };
  return table[k];
}

const ROLE_ENERGY: Record<SceneRole, number> = { hook: 4, problem: 2, reveal: 4, feature: 3, benefits: 3, proof: 3, cta: 4, signature: 2, statement: 3, data: 3, chapter: 2 };

/**
 * La courbe d'énergie : celle du directeur si elle est donnée, sinon celle des rôles autour du biais de la direction ;
 * un seul pic (5) — sur la révélation ou la scène qui tombe aux deux tiers du film.
 */
export function energyArc(roles: (SceneRole | undefined)[], bias = 3, given?: (number | undefined)[]): number[] {
  const n = roles.length;
  const shift = Math.round(bias - 3);
  let arc = roles.map((r, i) => clampEnergy(given?.[i] ?? (r ? ROLE_ENERGY[r] + shift : 3 + shift)));
  if (!given?.some((g) => g !== undefined) && n >= 3) {
    // Le moment fort : la révélation, sinon la scène aux deux tiers (60–80 % du film), hors signature.
    const reveal = roles.findIndex((r) => r === 'reveal' || r === 'statement');
    const peak = reveal >= 0 ? reveal : Math.min(n - 2, Math.max(1, Math.round(n * 0.66) - 1));
    arc = arc.map((e, i) => (i === peak ? 5 : Math.min(4, e)));
  }
  return arc;
}

/** L'indice du moment fort (énergie la plus haute, la première). */
export const peakIndex = (energy: number[]) => energy.reduce((best, e, i) => (e > energy[best] ? i : best), 0);

const OPPOSITE: Record<Direction4, Direction4> = { left: 'right', right: 'left', up: 'down', down: 'up' };

/**
 * Les coutures : `seams[i]` est la sortie de la scène i (et donc l'entrée de i+1). La dernière scène n'a pas de couture.
 * Déterministe : même film, mêmes coutures.
 */
export function planSeams(design: Pick<FilmDesign, 'motion'>, roles: (SceneRole | undefined)[], energy: number[], seed = 0): SeamSpec[] {
  const n = roles.length;
  if (n < 2) return [];
  const allowed = design.motion.seams.length ? design.motion.seams : (['cut-the-curve'] as SeamKind[]);
  const base = allowed[0];
  const current = design.motion.current;
  const peak = peakIndex(energy);
  const variety = allowed.filter((k) => k !== base && k !== 'inverse-zoom' && k !== 'cut');
  const out: SeamSpec[] = [];
  let cuts = 0;
  for (let i = 0; i < n - 1; i++) {
    const next = roles[i + 1];
    let spec: SeamSpec = { kind: base, dir: current };
    if (i + 1 === peak && allowed.includes('inverse-zoom')) spec = { kind: 'inverse-zoom', dir: current };
    else if ((next === 'cta' || next === 'statement') && (base === 'cut-the-curve' || allowed.includes('cut-the-curve'))) spec = { kind: 'cut-the-curve', dir: 'up' };
    else if (variety.length && (i + seed) % 3 === 2) spec = { kind: variety[Math.floor((i + seed) / 3) % variety.length], dir: current };
    if (spec.kind === 'cut') {
      if (cuts + 1 > Math.floor((n - 1) / 3)) spec = { kind: base === 'cut' ? 'cut-the-curve' : base, dir: current };
      else cuts++;
    }
    // Jamais deux coutures consécutives en sens opposés (« ping-pong »).
    const prev = out[i - 1];
    if (prev && spec.dir === OPPOSITE[prev.dir]) spec = { ...spec, dir: prev.dir };
    out.push(spec);
  }
  return out;
}

export interface TransitionCue {
  /** Scène qui ENTRE (indice). */
  scene: number;
  kind: 'whoosh' | 'softwhoosh' | 'riser' | 'impact' | 'shimmer' | 'pop' | 'tick';
  /** Gain relatif (0..1). */
  gain: number;
  /** Avance (s) avant la coupe pour que le pic du son tombe sur elle (une montée finit sur la coupe). */
  lead: number;
  /** Prise à utiliser quand la sonothèque en a plusieurs (rotation : jamais le même whoosh à chaque coupe). */
  take: number;
}

/** Les sons des transitions : environ une sur deux, variés, montée + impact une seule fois sur le moment fort. */
export function planTransitionCues(seams: SeamSpec[], energy: number[]): TransitionCue[] {
  const out: TransitionCue[] = [];
  const peak = peakIndex(energy);
  let takes = 0;
  seams.forEach((s, i) => {
    const into = i + 1;
    if (into === peak) {
      out.push({ scene: into, kind: 'riser', gain: 0.55, lead: 1.4, take: 0 }, { scene: into, kind: 'impact', gain: 0.7, lead: 0, take: 0 });
      return;
    }
    if (s.kind === 'cut' || s.kind === 'dip-cut') return;
    // Une transition sur deux (les fortes d'abord) : un effet à chaque coupe sonne « démo ».
    const strong = s.kind === 'whip' || s.kind === 'zoom-through' || (energy[into] ?? 3) >= 4;
    if (!strong && i % 2 === 1) return;
    const kind = s.kind === 'whip' || s.kind === 'zoom-through' ? 'whoosh' : s.kind === 'colour-flood' || s.kind === 'blur-swap' ? 'softwhoosh' : strong ? 'whoosh' : 'softwhoosh';
    out.push({ scene: into, kind, gain: kind === 'whoosh' ? 0.6 : 0.45, lead: kind === 'whoosh' ? 0.22 : 0.28, take: takes++ % 3 });
  });
  return out;
}

/**
 * Les coupes calées sur les temps de la musique (±120 ms), sans toucher à la durée totale ni couper une ligne de voix :
 * une coupe ne bouge que si les deux scènes gardent leur durée minimale et qu'aucune voix ne la traverse.
 */
export function snapCutsToBeats(scenes: { start: number; duration: number; voice?: { at: number; duration: number } }[], beats: number[], opts: { tolerance?: number; minDuration?: number } = {}): { start: number; duration: number }[] {
  const tol = opts.tolerance ?? 0.12;
  const min = opts.minDuration ?? 1;
  const total = scenes.reduce((a, s) => a + s.duration, 0);
  const cuts = scenes.slice(1).map((s) => s.start);
  const snapped = cuts.map((c, k) => {
    const near = beats.reduce((best, b) => (Math.abs(b - c) < Math.abs(best - c) ? b : best), Infinity);
    if (!Number.isFinite(near) || Math.abs(near - c) > tol) return c;
    const prevStart = k === 0 ? 0 : cuts[k - 1];
    const nextEnd = k + 1 < cuts.length ? cuts[k + 1] : total;
    if (near - prevStart < min || nextEnd - near < min) return c;
    // Une ligne de voix qui traverse la coupe : on ne la déplace pas.
    const voiceCross = [scenes[k], scenes[k + 1]].some((s) => s.voice && s.start + s.voice.at < near && s.start + s.voice.at + s.voice.duration > near && Math.abs(near - c) > 0.04);
    return voiceCross ? c : near;
  });
  const starts = [0, ...snapped];
  return starts.map((st, i) => ({ start: Math.round(st * 1000) / 1000, duration: Math.round(((i + 1 < starts.length ? starts[i + 1] : total) - st) * 1000) / 1000 }));
}

/** La durée (s) de la SORTIE d'une couture : elle finit exactement à la coupe (copie identique dans le kit, vérifiée). */
export const SEAM_OUT_SECONDS: Record<string, number> = { 'cut-the-curve': 0.32, 'zoom-through': 0.2, 'inverse-zoom': 0.2, whip: 0.2, 'blur-swap': 0.18, 'colour-flood': 0.42, 'dip-cut': 0.1, cut: 0 };
export const seamOutSeconds = (kind?: string) => (kind ? SEAM_OUT_SECONDS[kind] ?? 0 : 0);
