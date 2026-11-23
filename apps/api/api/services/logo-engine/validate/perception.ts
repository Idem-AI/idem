/**
 * LA PERCEPTION — une note esthétique MESURÉE, propre à chaque type de logo.
 *
 * Le rapport qualité (`assess.ts`) dit si un logo est exploitable ; il accepte presque tout ce
 * que le planificateur construit et ne classe donc rien. Cette note-ci classe : elle lit le rendu
 * (symétrie, topologie, régularité du trait, compacité, équilibre, rythme des lettres, rapport
 * symbole/nom) et le pondère selon le TYPE, parce qu'on ne juge pas un nom comme un sceau :
 *
 *   wordmark       rythme optique des lettres, contre-formes qui tiennent en petit, trait régulier
 *   lettermark     contre-formes, équilibre dans le contenant, trait régulier
 *   letterform     équilibre de la lettre, contre-formes, trait
 *   pictorial      silhouette (peu de morceaux, compacité moyenne), équilibre ; symétrie secondaire
 *   abstract       symétrie, simplicité topologique, trait, équilibre
 *   mascot         silhouette d'un seul tenant, quelques découpes (yeux), équilibre
 *   combination    le symbole (comme un abstrait) + masse et centre optique du nom alignés
 *   emblem         symétrie et centrage (sceau), contre-formes du texte
 *   dynamic        comme un abstrait
 *   minimal        très peu de morceaux et de trous, forme compacte
 *   negative-space vide enfermé ni anecdotique ni dominant, équilibre
 *
 * Ce n'est pas un couperet (aucun contrôle esthétique ne refuse un logo) : la note sert à CLASSER
 * les candidats et à guider l'affineur de paramètres. Seule une symétrie DÉCLARÉE et non tenue
 * produit un défaut, parce que c'est une promesse de construction.
 *
 * Références : Zhang et al., « Computational Aesthetic Evaluation of Logos », ACM TAP 2017
 * (équilibre, contraste, harmonie) ; Henderson & Cote, J. of Marketing 1998 (harmonie, naturel,
 * élaboration) ; Wu, PLOS ONE 2025 (symétrie et qualité perçue). Les seuils ci-dessous sont des
 * valeurs de départ à recaler sur des jugements humains (voir LOGO_ENGINE_MATHS.md).
 */
import type { ConceptType } from '../ir/logo.schema';
import type { LogoSession, RenderedLogo } from '../render/build';
import type { Rasterizer } from '../raster/rasterizer';
import { defaultRasterizer } from '../raster/rasterizer';
import { compactnessOf, declaredSymmetry, letterRhythm, massOffset, strokeConsistency, symmetryOf, toMask, topologyOf } from '../raster/perception';
import type { Mask } from '../raster/perception';
import { enclosedVoidRatio } from './practices';
import type { Defect } from './technical';

export type PerceptKey = 'symmetry' | 'stroke' | 'topology' | 'compactness' | 'balance' | 'counters' | 'rhythm' | 'mass' | 'opticalAlign' | 'spacing' | 'void';

export interface Perception {
  /** Note esthétique 0–100, pondérée par le profil du type. */
  score: number;
  /** Chaque critère, 0..1 (1 = idéal pour ce type). Absent : non mesurable ici. */
  parts: Partial<Record<PerceptKey, number>>;
  /** Mesures brutes (pour la trace et l'empreinte). */
  raw: {
    symmetryGroup: string;
    symmetryBest: number;
    declaredSymmetry?: number;
    pieces: number;
    holes: number;
    compactness: number;
    strokeConsistency: number;
    massX: number;
    massY: number;
    rhythm?: number;
    massRatio?: number;
    alignOffset?: number;
    enclosedVoid?: number;
  };
  defects: Defect[];
}

interface Profile {
  weights: Partial<Record<PerceptKey, number>>;
  /** Compacité attendue du symbole [bas, haut]. */
  compactness: [number, number];
  /** Morceaux et trous au-delà desquels la forme se lit mal. */
  maxPieces: number;
  maxHoles: number;
  /** Vide enfermé attendu (espace négatif). */
  void?: [number, number];
}

/** Les profils par type : quels critères comptent, et quelles formes sont attendues. */
export const PROFILES: Record<ConceptType, Profile> = {
  wordmark: { weights: { rhythm: 0.5, counters: 0.25, stroke: 0.25 }, compactness: [0, 1], maxPieces: 99, maxHoles: 99 },
  lettermark: { weights: { counters: 0.3, balance: 0.3, stroke: 0.25, symmetry: 0.15 }, compactness: [0.1, 1], maxPieces: 4, maxHoles: 6 },
  letterform: { weights: { balance: 0.35, counters: 0.3, stroke: 0.25, topology: 0.1 }, compactness: [0.1, 1], maxPieces: 3, maxHoles: 4 },
  pictorial: { weights: { compactness: 0.25, topology: 0.2, balance: 0.25, stroke: 0.15, symmetry: 0.15 }, compactness: [0.12, 0.8], maxPieces: 3, maxHoles: 5 },
  abstract: { weights: { symmetry: 0.25, topology: 0.25, stroke: 0.15, compactness: 0.1, balance: 0.25 }, compactness: [0.15, 0.9], maxPieces: 3, maxHoles: 4 },
  mascot: { weights: { topology: 0.25, compactness: 0.25, balance: 0.3, symmetry: 0.2 }, compactness: [0.2, 0.85], maxPieces: 2, maxHoles: 5 },
  // Le symbole d'un « combination » est jugé comme un abstrait plus tolérant ; sa relation au nom l'est par la composition.
  combination: { weights: { symmetry: 0.2, topology: 0.2, stroke: 0.15, compactness: 0.15, balance: 0.3 }, compactness: [0.12, 0.9], maxPieces: 4, maxHoles: 6 },
  emblem: { weights: { symmetry: 0.35, balance: 0.35, counters: 0.15, compactness: 0.15 }, compactness: [0.05, 1], maxPieces: 99, maxHoles: 99 },
  dynamic: { weights: { symmetry: 0.25, topology: 0.2, stroke: 0.15, compactness: 0.15, balance: 0.25 }, compactness: [0.15, 0.9], maxPieces: 5, maxHoles: 6 },
  minimal: { weights: { topology: 0.3, compactness: 0.3, balance: 0.2, symmetry: 0.2 }, compactness: [0.3, 1], maxPieces: 2, maxHoles: 1 },
  'negative-space': { weights: { void: 0.35, topology: 0.2, balance: 0.25, symmetry: 0.2 }, compactness: [0.1, 1], maxPieces: 3, maxHoles: 3, void: [0.1, 0.65] },
};

/** 1 dans [lo, hi], décroît linéairement jusqu'à 0 à `soft` au-delà. */
export const band = (v: number, lo: number, hi: number, soft: number) => (v < lo ? Math.max(0, 1 - (lo - v) / soft) : v > hi ? Math.max(0, 1 - (v - hi) / soft) : 1);

const SYMBOL_PX = 160;
const FULL_PX = 480;
/** Une symétrie déclarée est tenue au-delà de ce recouvrement (l'anticrénelage coûte ~2–4 %). */
export const SYMMETRY_KEPT = 0.9;

function symbolMasks(session: LogoSession, raster: Rasterizer) {
  const symbol = session.render({ layout: 'symbol-only' });
  if (!symbol) return Promise.resolve(null);
  return Promise.all([raster.render(symbol.svg, SYMBOL_PX, null), raster.render(symbol.svg, 32, null)]).then(([big, small]) => ({ big: toMask(big), small: toMask(small) }));
}

/** Le nom seul, rendu à `heightPx` de haut (72 : assez pour lire les espaces entre lettres ; 18 : la taille d'une en-tête). */
async function wordMask(session: LogoSession, raster: Rasterizer, heightPx = 72): Promise<Mask | null> {
  const word = session.render({ layout: 'wordmark-only' });
  if (!word) return null;
  const width = Math.min(1400, Math.round((heightPx * word.width) / Math.max(1, word.height)));
  return toMask(await raster.render(word.svg, width, null));
}

/** Contre-formes qui tiennent : les trous du symbole à 32 px rapportés à ceux du rendu net. */
function countersKept(big: Mask, small: Mask): number {
  const holes = topologyOf(big).holes;
  if (!holes) return 1;
  return Math.min(1, topologyOf(small).holes / holes);
}

export async function perceiveLogo(session: LogoSession, rendered: RenderedLogo, options: { rasterizer?: Rasterizer } = {}): Promise<Perception> {
  const raster = options.rasterizer ?? defaultRasterizer();
  const doc = session.doc;
  const type = doc.concept.type;
  const profile = PROFILES[type];
  const parts: Perception['parts'] = {};
  const defects: Defect[] = [];
  const raw: Perception['raw'] = { symmetryGroup: 'none', symmetryBest: 0, pieces: 0, holes: 0, compactness: 0, strokeConsistency: 1, massX: 0, massY: 0 };

  const symbol = await symbolMasks(session, raster);
  if (symbol) {
    const sym = symmetryOf(symbol.big);
    const topo = topologyOf(symbol.big);
    const stroke = strokeConsistency(symbol.big);
    const compact = compactnessOf(symbol.big);
    const mass = massOffset(symbol.big);
    Object.assign(raw, { symmetryGroup: sym.group, symmetryBest: sym.best, pieces: topo.pieces, holes: topo.holes, compactness: compact, strokeConsistency: stroke.consistency, massX: mass.x, massY: mass.y });

    // Symétrie : récompensée sans être exigée — sauf quand la construction l'a promise.
    parts.symmetry = band(sym.best, 0.88, 1, 0.5);
    const declared = doc.concept.symmetry;
    if (declared && declared !== 'none') {
      const kept = declaredSymmetry(symbol.big, declared);
      if (kept !== null) {
        raw.declaredSymmetry = kept;
        parts.symmetry = band(kept, SYMMETRY_KEPT, 1, 0.4);
        if (kept < SYMMETRY_KEPT) defects.push({ code: 'symmetry_broken', severity: 'warn', message: `La symétrie ${declared} promise n'est tenue qu'à ${Math.round(kept * 100)} % sur le rendu.` });
      }
    }
    parts.stroke = stroke.consistency;
    parts.topology = band(topo.pieces, 1, profile.maxPieces, 2.5) * band(topo.holes, 0, profile.maxHoles, 3);
    parts.compactness = band(compact, profile.compactness[0], profile.compactness[1], 0.25);
    parts.balance = Math.max(0, 1 - Math.hypot(mass.x, mass.y) / 0.12);
    parts.counters = countersKept(symbol.big, symbol.small);
    if (profile.void) {
      const ratio = enclosedVoidRatio({ width: symbol.big.w, height: symbol.big.h, rgba: rgbaOf(symbol.big) });
      raw.enclosedVoid = Math.round(ratio * 1000) / 1000;
      parts.void = band(ratio, profile.void[0], profile.void[1], 0.2);
    }
  }

  if (profile.weights.rhythm) {
    const word = await wordMask(session, raster);
    if (word) {
      const rhythm = letterRhythm(word);
      raw.rhythm = rhythm.rhythm;
      if (rhythm.glyphs >= 3) parts.rhythm = band(rhythm.rhythm, 0.8, 1, 0.5);
      if (!symbol) {
        parts.stroke = strokeConsistency(word).consistency;
        const small = await wordMask(session, raster, 18);
        if (small) parts.counters = countersKept(word, small);
      }
    }
  }

  // ── La composition, deuxième dimension, jugée dès qu'un symbole et un nom coexistent — quel que soit le type ──
  const composed = await composition(session, rendered, raster, raw);
  Object.assign(parts, composed);

  const weighted = (weights: Partial<Record<PerceptKey, number>>) => {
    let sum = 0;
    let total = 0;
    for (const [key, weight] of Object.entries(weights) as [PerceptKey, number][]) {
      const value = parts[key];
      if (value === undefined) continue;
      sum += weight * value;
      total += weight;
    }
    return total ? sum / total : null;
  };
  const typeScore = weighted(profile.weights);
  const compositionScore = weighted(COMPOSITION_WEIGHTS);
  // Un « combination » se définit par la relation symbole/nom : elle pèse davantage.
  const share = compositionScore === null ? 0 : type === 'combination' ? 0.45 : 0.3;
  const blended = typeScore === null ? compositionScore ?? 0 : (1 - share) * typeScore + share * (compositionScore ?? 0);
  return { score: Math.round(blended * 100), parts: roundParts(parts), raw, defects };
}

const COMPOSITION_WEIGHTS: Partial<Record<PerceptKey, number>> = { mass: 0.3, opticalAlign: 0.35, spacing: 0.35 };

/**
 * Symbole + nom : masse visuelle comparable, centres optiques alignés, respiration juste.
 *   horizontal  centre de masse du symbole ↔ milieu des lettres (axe vertical), écart 0,2–0,5 × symbole
 *   empilé      axe central partagé (horizontal), écart 0,12–0,4 × symbole
 */
async function composition(session: LogoSession, rendered: RenderedLogo, raster: Rasterizer, raw: Perception['raw']): Promise<Partial<Record<PerceptKey, number>>> {
  const { symbol: sBox, wordmark: wBox } = rendered.scene.boxes;
  const layout = rendered.layout;
  if (!sBox || !wBox || (layout !== 'horizontal' && layout !== 'stacked')) return {};
  const out: Partial<Record<PerceptKey, number>> = {};
  let symbolArea = 0;
  let wordArea = 0;
  for (const p of rendered.scene.groups.symbol) if (p.paint !== 'paper' && p.paint !== 'none') symbolArea += session.area(p.shape);
  for (const p of rendered.scene.groups.wordmark) if (p.paint !== 'paper' && p.paint !== 'none') wordArea += session.area(p.shape);
  if (symbolArea && wordArea) {
    const ratio = symbolArea / wordArea;
    raw.massRatio = Math.round(ratio * 100) / 100;
    out.mass = layout === 'horizontal' ? band(ratio, 0.45, 2.2, 1.2) : band(ratio, 0.3, 2.6, 1.2);
  }
  const full = toMask(await raster.render(rendered.svg, FULL_PX, null));
  const scale = full.w / rendered.width;
  const massCenter = (box: { x: number; y: number; w: number; h: number }) => {
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (let y = Math.max(0, Math.floor(box.y * scale)); y < Math.min(full.h, Math.ceil((box.y + box.h) * scale)); y++)
      for (let x = Math.max(0, Math.floor(box.x * scale)); x < Math.min(full.w, Math.ceil((box.x + box.w) * scale)); x++)
        if (full.data[y * full.w + x]) {
          n++;
          sx += x;
          sy += y;
        }
    return n ? { x: sx / n / scale, y: sy / n / scale } : { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  };
  const center = massCenter(sBox);
  if (layout === 'horizontal') {
    // Le centre optique du nom est le milieu de ses lettres (hauteur de capitale), celui du symbole son centre de masse.
    const offset = Math.abs(center.y - (wBox.y + wBox.h / 2)) / sBox.h;
    const gap = (wBox.x - (sBox.x + sBox.w)) / sBox.h;
    raw.alignOffset = Math.round(offset * 1000) / 1000;
    out.opticalAlign = band(offset, 0, 0.04, 0.16);
    out.spacing = band(gap, 0.18, 0.42, 0.3);
  } else {
    const offset = Math.abs(center.x - (wBox.x + wBox.w / 2)) / Math.max(sBox.w, 1);
    const gap = (wBox.y - (sBox.y + sBox.h)) / sBox.h;
    raw.alignOffset = Math.round(offset * 1000) / 1000;
    out.opticalAlign = band(offset, 0, 0.03, 0.12);
    out.spacing = band(gap, 0.12, 0.4, 0.25);
  }
  return out;
}

/** Note de classement d'un candidat : l'exploitabilité garde la main, la perception départage. */
export const rankScore = (report: { score: number; aesthetic?: number }) => (report.aesthetic === undefined ? report.score : Math.round(0.4 * report.score + 0.6 * report.aesthetic));

function rgbaOf(mask: Mask): Uint8Array {
  const out = new Uint8Array(mask.w * mask.h * 4);
  for (let i = 0; i < mask.data.length; i++) out[i * 4 + 3] = mask.data[i] ? 255 : 0;
  return out;
}

function roundParts(parts: Perception['parts']): Perception['parts'] {
  const out: Perception['parts'] = {};
  for (const [k, v] of Object.entries(parts)) if (v !== undefined) out[k as PerceptKey] = Math.round(v * 1000) / 1000;
  return out;
}
