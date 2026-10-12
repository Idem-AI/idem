/**
 * Les VARIANTES de composants : comment chaque bloc se dessine dans cette page.
 *
 * Un document garde une manière (ses tableaux, ses cartes, ses nuanciers se ressemblent d'une page à
 * l'autre : c'est ce qui en fait un document), puis s'en écarte de temps en temps, semé par la section.
 * La largeur disponible ferme les variantes qui n'y tiendraient pas (une frise horizontale dans une
 * colonne étroite, des flèches à cinq étapes).
 */
import type { BlockInfo } from './analyze';
import type { Variant } from '../design-system/components/types';
import type { Look } from '../design-system/look';
import type { DesignTokens } from '../design-system/tokens';
import { Rng } from '../foundation/rng';

export type VariantChooser = (block: BlockInfo, width?: number) => Variant;

export function variantChooser(seed: string, sectionId: string, look: Look, tokens: DesignTokens): VariantChooser {
  const doc = (kind: string) => new Rng(`${seed}:variant:${kind}`);
  const section = (kind: string) => new Rng(`${seed}:variant:${kind}:${sectionId}`);
  const pick = <T>(kind: string, values: readonly T[], drift = 0.25): T => {
    const own = doc(kind).pick(values);
    const s = section(kind);
    return s.chance(drift) ? s.pick(values) : own;
  };
  const fullWidth = tokens.format.width - tokens.format.pad * 2;
  const soft = tokens.style.radius >= 16;

  return (block, width = fullWidth): Variant => {
    const narrow = width < tokens.size.base * 26;
    switch (block.kind) {
      case 'metrics':
        if (narrow) return { style: 'stacked' };
        return { style: look.tension === 'ruled' ? 'ruled' : pick('metrics', soft ? (['tiles', 'row', 'ruled'] as const) : (['ruled', 'row', 'tiles'] as const)) };
      case 'cards':
        return { style: pick('cards', soft ? (['raised', 'outline', 'numbered', 'accent-bar'] as const) : (['ruled', 'outline', 'numbered', 'accent-bar', 'plain', 'raised'] as const)), cols: 0 };
      case 'table':
        return { style: pick('table', soft ? (['zebra', 'boxed', 'ruled'] as const) : (['ruled', 'minimal', 'zebra', 'boxed'] as const), 0.1), density: narrow ? 'compact' : 'regular' };
      case 'quote':
        return { style: pick('quote', ['bar', 'pull', 'boxed', 'centered'] as const, 0.5) };
      case 'timeline':
        return { style: width >= tokens.size.base * 40 ? pick('timeline', ['horizontal', 'vertical', 'numbered'] as const) : pick('timeline-narrow', ['vertical', 'numbered'] as const) };
      case 'steps':
        return { style: width >= tokens.size.base * 36 ? pick('steps', ['numbered', 'arrows', 'ladder'] as const) : 'ladder' };
      case 'prose': {
        const s = section('prose');
        return { lead: s.chance(0.35), dropcap: tokens.style.id === 'editorial' && s.chance(0.3), columns: 1, measure: tokens.format.family === 'document' ? 'readable' : 'full' };
      }
      case 'chart':
        return { frame: soft ? pick('chart', ['panel', 'none'] as const, 0.2) : 'none', legend: 'top' };
      case 'assumption':
        return { style: pick('assumption', ['callout', 'ruled'] as const, 0.2) };
      case 'comparison':
        return { highlight: 0, style: narrow ? 'cards' : pick('comparison', ['grid', 'cards'] as const, 0.2) };
      case 'swatches':
        return { style: pick('swatches', ['chips', 'band', 'rows'] as const, 0.1) };
      case 'swot':
        return { style: soft ? 'tinted' : pick('swot', ['tinted', 'ruled'] as const, 0.1) };
      case 'funnel':
        return { style: pick('funnel', ['bars', 'stepped'] as const, 0.2) };
      case 'persona':
        return { style: narrow ? 'card' : pick('persona', ['card', 'split'] as const) };
      case 'riskMatrix':
        return { style: narrow ? 'list' : 'matrix' };
      case 'typeSpecimen':
        return { style: pick('typeSpecimen', ['stack', 'side'] as const, 0.2) };
      case 'logoDisplay':
        return { style: pick('logoDisplay', ['grid', 'row'] as const, 0.2) };
      case 'logoStory':
      case 'imageryShowcase':
        return { side: pick(block.kind, ['left', 'right'] as const, 0.4) };
      case 'figure':
        return { ratio: width > tokens.size.base * 40 ? 1.6 : 1.333, frame: false };
      default:
        return {};
    }
  };
}
