/**
 * LE RAPPORT QUALITÉ — validation technique + validation visuelle d'un logo et de ses variantes.
 *
 * `blocker` : le logo n'est pas exploitable (fichier invalide, symbole absent, rendu vide).
 * `warn`    : exploitable, mais perfectible — c'est ce que l'auto-amélioration cherche à lever.
 * Le score (0–100) résume ; il ne remplace pas la lecture des défauts.
 */
import type { LogoSession, RenderedLogo } from '../render/build';
import { paletteColors, resolvePaint } from '../render/svg';
import { renderVariants } from '../render/variants';
import type { Rasterizer } from '../raster/rasterizer';
import { defaultRasterizer } from '../raster/rasterizer';
import type { Defect } from './technical';
import { validateSvgTechnical } from './technical';
import { assessVisual } from './visual';

export interface QualityReport {
  /** Aucun défaut bloquant. */
  ok: boolean;
  /** `ok` et score suffisant : un logo qu'on peut montrer sans retouche. */
  accepted: boolean;
  score: number;
  defects: Defect[];
  metrics: Record<string, number>;
  variants: { id: string; ok: boolean }[];
}

export const ACCEPT_SCORE = 78;

const PENALTY = { blocker: 40, warn: 7 } as const;

/** Les couleurs que le fichier a le droit d'utiliser : la palette, ses dérivées inversées, les neutres. */
export function allowedColors(session: LogoSession): string[] {
  const doc = session.doc;
  const out = new Set<string>(['#111111', '#ffffff']);
  const roles = paletteColors(doc.palette);
  for (const mode of ['original', 'inverted'] as const) {
    for (const role of ['ink', 'ink2', 'accent'] as const) {
      const c = resolvePaint(role, { palette: doc.palette, mode });
      if (c) out.add(c);
    }
  }
  Object.values(roles).forEach((c) => out.add(c.toLowerCase()));
  return [...out];
}

export async function assessLogo(session: LogoSession, rendered: RenderedLogo, options: { rasterizer?: Rasterizer; skipVariants?: boolean } = {}): Promise<QualityReport> {
  const rasterizer = options.rasterizer ?? defaultRasterizer();
  const palette = allowedColors(session);
  const defects: Defect[] = [];

  const technical = await validateSvgTechnical(rendered.svg, { palette, rasterizer });
  defects.push(...technical.defects);

  for (const w of session.warnings) {
    if (w.code === 'font_unavailable' || w.code === 'glyph_missing') defects.push({ code: w.code, severity: 'blocker', message: w.message, layerId: w.layerId });
    else if (w.code === 'boolean_failed' || w.code === 'generator_unknown' || w.code === 'geometry_invalid') defects.push({ code: w.code, severity: 'warn', message: w.message, layerId: w.layerId });
  }

  const visual = await assessVisual(session, rendered, { rasterizer });
  defects.push(...visual.defects);

  const variants: QualityReport['variants'] = [];
  if (!options.skipVariants) {
    for (const variant of renderVariants(session)) {
      const report = await validateSvgTechnical(variant.svg, { palette, rasterizer, expectTransparent: true });
      variants.push({ id: variant.id, ok: report.ok });
      if (!report.ok) defects.push({ code: 'variant_invalid', severity: 'blocker', message: `La variante « ${variant.id} » n'est pas valide : ${report.defects.filter((d) => d.severity === 'blocker').map((d) => d.message).join(' ')}` });
    }
  }

  const unique = dedupe(defects);
  const penalty = unique.reduce((sum, d) => sum + PENALTY[d.severity], 0);
  const score = Math.max(0, 100 - penalty);
  const ok = !unique.some((d) => d.severity === 'blocker');
  return { ok, accepted: ok && score >= ACCEPT_SCORE, score, defects: unique, metrics: { ...visual.metrics, bytes: technical.bytes, paths: technical.paths, nodes: technical.nodes }, variants };
}

function dedupe(defects: Defect[]): Defect[] {
  const seen = new Set<string>();
  return defects.filter((d) => {
    const key = `${d.code}|${d.layerId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Résumé d'une ligne par défaut, réinjectable dans un prompt de correction. */
export const summarizeDefects = (defects: Defect[]) => defects.map((d) => `[${d.code}${d.layerId ? `@${d.layerId}` : ''}] ${d.message}`).join(' | ');
