/**
 * Les motifs de la marque, dessinés en CSS depuis sa palette.
 *
 * Ils servaient une seule page, celle des motifs. Les bannières de réseaux
 * sociaux en ont maintenant besoin aussi : une bannière qui reprend le motif
 * de la charte est reconnaissable comme appartenant à la marque, une bannière
 * qui en invente un ne l'est pas. Le répertoire vit donc ici, et les deux
 * rendus le lisent au même endroit.
 */

import { DocumentDesignSystem } from './documentDesignSystem';

export type MotifName = 'stripes' | 'grid' | 'dots' | 'chevron' | 'arcs' | 'checker';

/**
 * Le répertoire de motifs d'une marque, dans l'ordre où la charte les emploie.
 *
 * Tiré de la FAMILLE de style plutôt que de son identifiant : deux styles
 * proches doivent partager leur vocabulaire. La famille se lit sur le rayon du
 * design system — angles vifs, rayon franc ou intermédiaire.
 */
export function brandMotifs(ds: DocumentDesignSystem): MotifName[] {
  if (ds.radius === 0) return ['grid', 'stripes', 'checker', 'dots'];
  if (ds.radius >= 12) return ['arcs', 'dots', 'stripes', 'chevron'];
  return ['chevron', 'checker', 'stripes', 'arcs'];
}

/**
 * Un motif en `background-image`, à partir de deux encres de la charte.
 *
 * `scale` agrandit la trame proportionnellement : une bannière de 1 800 px ne
 * porte pas la trame d'une vignette de 34 mm.
 */
export function patternCss(
  motif: string,
  ink: string,
  ground: string,
  scale = 1
): Record<string, string> {
  const px = (value: number) => `${Math.round(value * scale * 10) / 10}px`;
  switch (motif) {
    case 'stripes':
      return {
        'background-color': ground,
        'background-image': `repeating-linear-gradient(45deg, ${ink} 0 ${px(6)}, transparent ${px(6)} ${px(16)})`,
      };
    case 'grid':
      return {
        'background-color': ground,
        'background-image': `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
        'background-size': `${px(12)} ${px(12)}`,
      };
    case 'dots':
      return {
        'background-color': ground,
        'background-image': `radial-gradient(${ink} ${px(1.6)}, transparent ${px(1.7)})`,
        'background-size': `${px(10)} ${px(10)}`,
      };
    case 'chevron':
      return {
        'background-color': ground,
        'background-image': `repeating-linear-gradient(135deg, ${ink} 0 ${px(4)}, transparent ${px(4)} ${px(12)}), repeating-linear-gradient(45deg, ${ink} 0 ${px(4)}, transparent ${px(4)} ${px(12)})`,
      };
    case 'arcs':
      return {
        'background-color': ground,
        'background-image': `radial-gradient(circle at 0 100%, transparent ${px(12)}, ${ink} ${px(12)}, ${ink} ${px(14)}, transparent ${px(14)})`,
        'background-size': `${px(20)} ${px(20)}`,
      };
    case 'checker':
    default:
      return {
        'background-color': ground,
        'background-image': `linear-gradient(45deg, ${ink} 25%, transparent 25% 75%, ${ink} 75%), linear-gradient(45deg, ${ink} 25%, transparent 25% 75%, ${ink} 75%)`,
        'background-size': `${px(16)} ${px(16)}`,
        'background-position': `0 0, ${px(8)} ${px(8)}`,
      };
  }
}
