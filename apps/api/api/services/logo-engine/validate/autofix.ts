/**
 * L'AUTO-AMÉLIORATION — des défauts mesurés aux corrections ciblées, sans aucun token.
 *
 * Chaque défaut du rapport qualité a, quand c'est possible, une correction locale :
 * un contraste insuffisant éclaircit/assombrit l'encre, des détails trop fins épaississent les
 * traits, un symbole trop détaillé réduit ses répétitions, un nom écrasé change l'échelle du
 * symbole… La correction est exprimée en patch (voir `ir/patch.ts`) : les couches satisfaisantes
 * ne sont jamais touchées. On s'arrête dès que le seuil est atteint (jamais de recherche du
 * maximum) et au bout de deux tours.
 */
import type { LogoDocument } from '../ir/logo.schema';
import { walkLayers } from '../ir/logo.schema';
import type { PatchOp } from '../ir/patch';
import { applyPatch } from '../ir/patch';
import { getGenerator } from '../render/generators';
import { LIGHT_BACKGROUND } from '../render/svg';
import { ensureContrast } from '../util/colors';
import type { Defect } from './technical';

/** Paramètres d'épaisseur et de densité, par ordre de pertinence. */
const THICKNESS_KEYS = ['thick', 'thickness', 'width', 'stroke'];
const DENSITY_KEYS = ['count', 'rays', 'petals', 'teeth', 'layers', 'grid', 'meridians', 'veins', 'rows', 'peaks', 'points', 'dots', 'toes'];

export interface FixLog {
  defect: string;
  action: string;
}

function numericRange(generator: string, key: string): { min: number; max: number; def: number; int: boolean } | null {
  const def = getGenerator(generator)?.params[key];
  return def && def.kind === 'num' ? { min: def.min, max: def.max, def: def.def, int: !!def.int } : null;
}

/** Scale un paramètre numérique d'un générateur, dans ses bornes. */
function scaleParam(doc: LogoDocument, key: string, factor: number): PatchOp[] {
  const ops: PatchOp[] = [];
  walkLayers(doc.layers, (layer) => {
    if (layer.kind !== 'generator') return;
    const range = numericRange(layer.generator, key);
    if (!range) return;
    const current = typeof layer.params[key] === 'number' ? (layer.params[key] as number) : range.def;
    let next = Math.min(range.max, Math.max(range.min, current * factor));
    if (range.int) next = factor < 1 ? Math.min(range.max, Math.max(range.min, Math.floor(current * factor))) : Math.round(next);
    if (next !== current) ops.push({ op: 'layer', id: layer.id, params: { [key]: Math.round(next * 100) / 100 } });
  });
  return ops;
}

export function planFixes(doc: LogoDocument, defects: Defect[]): { ops: PatchOp[]; log: FixLog[] } {
  const ops: PatchOp[] = [];
  const log: FixLog[] = [];
  const has = (code: string) => defects.find((d) => d.code === code);
  const note = (defect: string, action: string, newOps: PatchOp[]) => {
    if (!newOps.length) return;
    ops.push(...newOps);
    log.push({ defect, action });
  };

  if (has('low_contrast_ink')) {
    const ink = ensureContrast(doc.palette.ink, LIGHT_BACKGROUND, 3.3);
    if (ink !== doc.palette.ink) note('low_contrast_ink', `encre principale ${doc.palette.ink} → ${ink}`, [{ op: 'palette', ink }]);
  }
  if (has('low_contrast_accent') && doc.palette.accent) {
    const accent = ensureContrast(doc.palette.accent, LIGHT_BACKGROUND, 1.8);
    if (accent !== doc.palette.accent) note('low_contrast_accent', `accent ${doc.palette.accent} → ${accent}`, [{ op: 'palette', accent }]);
  }
  if (has('thin_details') || has('illegible_small') || has('symbol_thin') || has('too_faint')) {
    const bump: PatchOp[] = THICKNESS_KEYS.flatMap((key) => scaleParam(doc, key, 1.3));
    walkLayers(doc.layers, (layer) => {
      if (layer.kind === 'text' && layer.font.weight < 800 && layer.role !== 'tagline') bump.push({ op: 'text', id: layer.id, weight: layer.font.weight + 100 });
    });
    note('thin_details', 'traits épaissis de 30 %, graisse du texte relevée', bump);
  }
  if (has('too_complex')) {
    const trim = DENSITY_KEYS.flatMap((key) => scaleParam(doc, key, 0.75));
    note('too_complex', 'répétitions réduites de 25 %', trim);
  }
  if (has('too_many_colors')) {
    if (doc.palette.accent && doc.palette.ink2) note('too_many_colors', 'l\'accent rejoint la seconde encre', [{ op: 'palette', accent: doc.palette.ink2 }]);
    else if (doc.palette.ink2) note('too_many_colors', 'la seconde encre rejoint l\'encre principale', [{ op: 'palette', ink2: doc.palette.ink }]);
  }
  if (has('crowded')) note('crowded', 'espace symbole/nom augmenté', [{ op: 'composition', gap: Math.min(1.2, doc.composition.gap + 0.12) }]);
  if (has('no_breathing_room')) note('no_breathing_room', 'marge de sécurité augmentée', [{ op: 'composition', padding: Math.min(0.4, doc.composition.padding + 0.05) }]);
  if (has('wordmark_dominates')) note('wordmark_dominates', 'symbole agrandi', [{ op: 'composition', symbolScale: Math.min(6, (doc.composition.symbolScale ?? 2.7) + 0.7) }]);
  if (has('wordmark_tiny')) note('wordmark_tiny', 'symbole réduit', [{ op: 'composition', symbolScale: Math.max(1, (doc.composition.symbolScale ?? 2.7) - 0.6) }]);
  if (has('too_many_weights') || has('too_many_fonts')) {
    const texts: PatchOp[] = [];
    let weight: number | undefined;
    walkLayers(doc.layers, (layer) => {
      if (layer.kind !== 'text') return;
      weight = weight ?? layer.font.weight;
      if (layer.font.weight !== weight && layer.role !== 'tagline') texts.push({ op: 'text', id: layer.id, weight });
    });
    note('too_many_weights', 'graisses unifiées', texts);
  }
  return { ops, log };
}

/** Applique les corrections d'un tour. `null` si rien n'est corrigeable. */
export function fixOnce(doc: LogoDocument, defects: Defect[]): { doc: LogoDocument; log: FixLog[] } | null {
  const { ops, log } = planFixes(doc, defects);
  if (!ops.length) return null;
  const result = applyPatch(doc, ops);
  return result.ok && result.doc ? { doc: result.doc, log } : null;
}
