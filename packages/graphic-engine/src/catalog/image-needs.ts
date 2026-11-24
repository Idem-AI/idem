/**
 * LES BESOINS D'IMAGE D'UNE PAGE COMPOSÉE — ce que le gabarit retenu demande à sa photo, calculé par le code (0 jeton).
 *
 * Une photo choisie AVANT le gabarit ne lui convient que par hasard : un visage cadré serré dans un bandeau vertical,
 * un paysage dans un cercle, un sujet décentré dans une arche. L'hôte planifie donc la page (gabarit, cadrage), lit ces
 * besoins, puis cherche ou génère l'image qui leur convient, et rend la page épinglée sur ce gabarit.
 *
 *   aspect / width / height   la zone réelle de l'image sur la toile (pixels), fond perdu compris
 *   shape, subject, framing   ce que déclare le composant de cadrage (`image` de son node.json), sinon déduit
 *   cutout, calm              un sujet détouré, un fond peu chargé
 */
import type { FormatDef } from '../design-system/formats';
import { assignUnits, type PageUnit } from './assemble';
import type { ComponentNode, ImageNeedsSpec, LayoutNode, LoadedCatalog, PageConfig } from './types';

export interface ImageNeeds extends ImageNeedsSpec {
  /** Largeur / hauteur de la zone de l'image. */
  aspect: number;
  /** Taille de la zone sur la toile, en pixels. */
  width: number;
  height: number;
  /** L'orientation à demander à une banque ou à un modèle d'image. */
  orientation: 'portrait' | 'landscape' | 'square';
  /** La zone touche le bord de la toile (photo à fond perdu). */
  bleed: boolean;
  /** Le composant de cadrage retenu. */
  component?: string;
}

/** Les besoins de la PREMIÈRE image de la page (unité `figure`), ou `null` si la composition n'en pose aucune. */
export function imageNeedsFor(cat: LoadedCatalog, config: PageConfig, units: PageUnit[], format: FormatDef): ImageNeeds | null {
  const layout = cat.nodes.get(config.layout) as LayoutNode | undefined;
  const figure = units.find((u) => u.kind === 'figure');
  if (!layout || layout.kind !== 'layout' || !figure) return null;
  const placed = assignUnits(layout, units).zones;
  const zone = layout.zones.find((z) => (placed.get(z.id) ?? []).some((u) => u.id === figure.id));
  if (!zone) return null;
  const s = format.safe;
  const innerW = format.width - s.left - s.right;
  const innerH = format.height - s.top - s.bottom;
  const cols = layout.grid.columns;
  const rows = Math.max(1, layout.grid.rows);
  let width = (innerW * zone.span) / cols;
  let height = (innerH * (zone.rows ?? 1)) / rows;
  if (zone.bleed) {
    if (zone.col === 1) width += s.left;
    if (zone.col + zone.span - 1 === cols) width += s.right;
    if (zone.row === 1) height += s.top;
    if (zone.row + (zone.rows ?? 1) - 1 === rows) height += s.bottom;
  }
  // Plusieurs unités dans la zone : l'image n'en prend qu'une part (la hauteur est partagée).
  const share = (placed.get(zone.id) ?? []).length;
  if (share > 1) height = height / Math.min(share, 2);
  // Les composants d'une configuration sont rangés par UNITÉ (identifiant du bloc) ; un gabarit les range par sorte.
  const comp = cat.nodes.get(config.components?.[figure.id] ?? config.components?.figure ?? '') as ComponentNode | undefined;
  const declared: Partial<ImageNeedsSpec> = comp?.kind === 'component' ? comp.image ?? {} : {};
  const shape = declared.shape ?? 'rect';
  // Un cadre rond, en arche ou en galet s'inscrit dans un carré : c'est le carré qu'il faut à l'image.
  const squareish = shape === 'circle' || shape === 'blob';
  const aspect = squareish ? 1 : shape === 'arch' ? Math.min(width / height, 0.72) : width / Math.max(1, height);
  const orientation = aspect > 1.15 ? 'landscape' : aspect < 0.87 ? 'portrait' : 'square';
  return {
    shape,
    subject: declared.subject ?? (aspect < 0.6 ? 'person' : 'any'),
    framing: declared.framing ?? (squareish || shape === 'arch' ? 'centered' : aspect > 1.6 ? 'wide' : 'thirds'),
    ...(declared.cutout ? { cutout: true } : {}),
    ...(declared.calm || zone.bleed ? { calm: true } : {}),
    aspect: Math.round(aspect * 1000) / 1000,
    width: Math.round(squareish ? Math.min(width, height) : width),
    height: Math.round(squareish ? Math.min(width, height) : height),
    orientation,
    bleed: Boolean(zone.bleed),
    ...(comp ? { component: comp.id } : {}),
  };
}
