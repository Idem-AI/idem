/**
 * L'ANALYSE d'une section : ce que la composition doit savoir du contenu AVANT de le mettre en page —
 * combien il pèse, ce qui réclame la pleine largeur, ce qui peut tenir côte à côte, ce qui peut porter la
 * page (un chiffre-clé, un graphique, une image).
 *
 * Les poids sont en FRACTION D'UNE PAGE A4 utile, la calibration héritée du moteur précédent : une page
 * pleine porte ~3 600 signes de texte courant ; les autres poids sont des hauteurs occupées, un peu
 * généreuses (sous-estimer produit une page coupée, surestimer une page un peu creuse).
 */
import type { Block, BlockKind, SectionContent, SectionRole } from '../contracts/content-model';
import { SPECIMEN_BLOCK_KINDS } from '../contracts/content-model';
import { componentFor } from '../design-system/components/registry';

const CHARS_PER_PAGE = 3600;

export interface BlockInfo {
  id: string;
  kind: BlockKind;
  /** Fraction d'une page A4 utile, à pleine largeur. */
  weight: number;
  /** Réclame la pleine largeur (tableau large, graphique à nombreuses étiquettes, canevas…). */
  wide: boolean;
  /** Peut porter la page à lui seul (chiffres-clés, graphique, image, citation). */
  hero: boolean;
  /** Prend la place qu'on lui donne, jusqu'à un minimum (graphique, spécimen, maquette) : il ne déborde pas, il rétrécit. */
  elastic: boolean;
  chars: number;
}

export interface ContentAnalysis {
  sectionId: string;
  role?: SectionRole;
  blocks: BlockInfo[];
  kinds: Set<BlockKind>;
  hero?: BlockInfo;
  /** Signes de texte (titre, chapô et blocs). */
  chars: number;
  /** Poids total, en pages A4 utiles. */
  weight: number;
  /** La part du poids portée par des blocs élastiques. */
  elasticWeight: number;
  specimen: boolean;
  dataHeavy: boolean;
  /** Peu de matière : une page qui RESPIRE (ouverture, citation, page courte). */
  light: boolean;
  hasLede: boolean;
  titleLength: number;
  /** Face d'une carte de visite (bloc `contact`) : un recto ne sert jamais de verso. */
  cardSide?: 'front' | 'back';
}

function blockChars(block: Block): number {
  return JSON.stringify(block).replace(/"[a-zA-Z]+":/g, '').replace(/[{}[\]",]/g, ' ').length;
}

export function blockWeight(block: Block): number {
  switch (block.kind) {
    case 'prose':
      return block.paragraphs.join(' ').length / CHARS_PER_PAGE + 0.02;
    case 'cards':
      return block.items.reduce((t, i) => t + 0.05 + (i.title.length + i.body.length) / (CHARS_PER_PAGE * 2), 0);
    case 'table':
      return 0.05 + block.rows.length * 0.032;
    case 'metrics':
      return 0.12;
    case 'chart':
      return 0.3;
    case 'quote':
      return 0.08 + block.text.length / CHARS_PER_PAGE;
    case 'timeline':
      return 0.05 + block.steps.length * 0.06;
    case 'assumption':
      return 0.1;
    case 'figure':
      return 0.3;
    case 'comparison':
      return 0.05 + block.rows.length * 0.04;
    case 'steps':
      return 0.18 + block.items.length * 0.02;
    case 'swot':
      return 0.42;
    case 'funnel':
      return 0.08 + block.stages.length * 0.04;
    case 'persona':
      return 0.3;
    case 'riskMatrix':
      return 0.32;
    case 'businessModel':
      return 0.55;
    case 'swatches':
      return 0.22;
    case 'typeSpecimen':
      return 0.12 * block.specimens.length + 0.05;
    case 'logoDisplay':
      return block.variants.length === 1 ? 0.45 : 0.25;
    case 'typeScale':
      return 0.06 * block.levels.length + 0.05;
    case 'patternGrid':
      return 0.25;
    case 'socialPosts':
    case 'socialBanners':
      return 0.5;
    case 'mockupShowcase':
      return 0.6;
    case 'logoStory':
    case 'imageryShowcase':
      return 0.55;
    case 'artDirectionStance':
      // Le nom du style en grand et le vocabulaire à côté : la raison, en corps de lecture, fait varier le poids.
      return 0.14 + (block.rationale.length / CHARS_PER_PAGE) * 1.5;
    case 'artDirectionRules':
      return 0.08 + block.rows.length * 0.035 + (block.dos.length + block.donts.length) * 0.03;
    case 'compositionPrinciples':
      return 0.45;
    case 'sources':
      return 0.05 + block.items.length * 0.03;
    case 'copy':
      return 0.3;
    case 'cover':
      return 1;
    case 'contact':
      return 0.3;
  }
}

function isWide(block: Block): boolean {
  switch (block.kind) {
    case 'table':
      return block.headers.length >= 4;
    case 'chart':
      // Une courbe de six points n'a pas besoin de toute la largeur ; une série longue ou nombreuse, si.
      return block.labels.length > 8 || block.series.length > 3;
    case 'comparison':
    case 'businessModel':
    case 'swot':
    case 'mockupShowcase':
    case 'socialBanners':
    case 'socialPosts':
    case 'patternGrid':
    case 'compositionPrinciples':
    case 'logoStory':
    case 'imageryShowcase':
    case 'artDirectionStance':
    case 'artDirectionRules':
      return true;
    case 'swatches':
      return block.items.length >= 5;
    case 'timeline':
      return block.steps.length >= 4;
    case 'steps':
      return block.items.length >= 4;
    case 'cards':
      return block.items.length >= 4;
    default:
      return false;
  }
}

const HERO_KINDS = new Set<BlockKind>(['metrics', 'chart', 'figure', 'quote']);

export function analyzeSection(section: SectionContent): ContentAnalysis {
  const blocks: BlockInfo[] = section.blocks.map((b) => ({
    id: b.id,
    kind: b.kind,
    weight: blockWeight(b),
    wide: isWide(b),
    hero: HERO_KINDS.has(b.kind),
    elastic: Boolean(componentFor(b.kind)?.elastic),
    chars: blockChars(b),
  }));
  const chars = section.title.length + (section.lede?.length ?? 0) + blocks.reduce((s, b) => s + b.chars, 0);
  const weight = 0.12 + (section.lede ? 0.04 : 0) + blocks.reduce((s, b) => s + b.weight, 0);
  const kinds = new Set(blocks.map((b) => b.kind));
  const contact = section.blocks.find((b) => b.kind === 'contact');
  return {
    cardSide: contact && contact.kind === 'contact' ? contact.side : undefined,
    sectionId: section.id,
    role: section.role,
    blocks,
    kinds,
    hero: blocks.find((b) => b.hero),
    chars,
    weight,
    elasticWeight: blocks.filter((b) => b.elastic).reduce((s, b) => s + b.weight, 0),
    specimen: blocks.some((b) => SPECIMEN_BLOCK_KINDS.has(b.kind)),
    dataHeavy: blocks.some((b) => b.kind === 'table' || b.kind === 'chart' || b.kind === 'comparison'),
    light: weight < 0.32 && blocks.length <= 2,
    hasLede: Boolean(section.lede),
    titleLength: section.title.length,
  };
}
