/**
 * Les MOTIFS de la marque, dessinés en CSS pur à deux encres de la charte.
 *
 * Ils servent de repli quand le fichier du motif n'a pas été déposé (la page « Motifs » de la charte, les
 * vignettes d'un profil social), et le répertoire d'un style dit lesquels lui conviennent : un book suisse
 * sort en filets et en grille, un book rétro en chevrons et en damier. Sans répertoire, les quatre mêmes
 * motifs revenaient sur toutes les marques.
 */
import { resolveStyle } from '../tokens';

export type MotifName = 'stripes' | 'grid' | 'dots' | 'chevron' | 'arcs' | 'checker' | 'weave' | 'contours';

/** Le répertoire de motifs d'un style, du plus caractéristique au plus discret. Lu sur son rayon : un angle vif appelle la trame, un arrondi la courbe. */
export function styleMotifs(styleId?: string | null): MotifName[] {
  const radius = resolveStyle(styleId).radius;
  if (radius === 0) return ['grid', 'stripes', 'checker', 'dots'];
  if (radius >= 12) return ['arcs', 'dots', 'stripes', 'chevron'];
  return ['chevron', 'checker', 'stripes', 'arcs'];
}

/** Un motif en déclarations CSS (fond), à l'échelle `scale` (1 = tuile d'une page A4). */
export function motifCss(motif: string, ink: string, ground: string, scale = 1): Record<string, string> {
  const px = (value: number): string => `${Math.round(value * scale * 10) / 10}px`;
  switch (motif) {
    case 'stripes':
      return { 'background-color': ground, 'background-image': `repeating-linear-gradient(45deg, ${ink} 0 ${px(6)}, transparent ${px(6)} ${px(16)})` };
    case 'grid':
      return { 'background-color': ground, 'background-image': `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`, 'background-size': `${px(16)} ${px(16)}` };
    case 'dots':
      return { 'background-color': ground, 'background-image': `radial-gradient(${ink} ${px(2)}, transparent ${px(2.5)})`, 'background-size': `${px(14)} ${px(14)}` };
    case 'chevron':
      return { 'background-color': ground, 'background-image': `linear-gradient(135deg, ${ink} 25%, transparent 25%), linear-gradient(225deg, ${ink} 25%, transparent 25%)`, 'background-size': `${px(20)} ${px(20)}` };
    case 'checker':
      return { 'background-color': ground, 'background-image': `conic-gradient(${ink} 25%, transparent 0 50%, ${ink} 0 75%, transparent 0)`, 'background-size': `${px(20)} ${px(20)}` };
    case 'arcs':
      return { 'background-color': ground, 'background-image': `radial-gradient(circle at 0 0, transparent ${px(9)}, ${ink} ${px(10)}, ${ink} ${px(12)}, transparent ${px(13)})`, 'background-size': `${px(22)} ${px(22)}` };
    default:
      return { 'background-color': ground, 'background-image': `repeating-linear-gradient(0deg, ${ink} 0 ${px(2)}, transparent ${px(2)} ${px(10)}), repeating-linear-gradient(90deg, ${ink} 0 ${px(2)}, transparent ${px(2)} ${px(10)})` };
  }
}
