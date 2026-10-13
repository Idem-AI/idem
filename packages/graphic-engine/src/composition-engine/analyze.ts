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
import type { SlideIntent, TextBudget } from '../contracts/slide-intent';
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
  /** L'intention de la page (stratégie visuelle, budget de texte), quand l'hôte l'a donnée. */
  intent?: SlideIntent;
  /** Les mots que la page donne à LIRE : titre et chapô, puis le texte des blocs rédigés. */
  words: { headline: number; body: number; bullets: number };
  /** Un bloc `figure` est présent (photo, capture, illustration). */
  hasFigure: boolean;
  /** Un bloc `points` de trois à six points sans média : la matière d'un schéma rayonnant. */
  hubPoints: boolean;
}

const countWords = (value: string | undefined): number => (value ? value.split(/\s+/).filter((w) => /[\p{L}]/u.test(w)).length : 0);

/**
 * Les mots à LIRE dans les blocs : les paragraphes, les corps de cartes, les détails. Les chiffres, les
 * étiquettes d'axe et les tableaux (des données qu'on parcourt, pas un texte qu'on lit) n'y comptent pas.
 */
function bodyWords(block: Block): { words: number; bullets: number } {
  switch (block.kind) {
    case 'prose':
      return { words: countWords(block.paragraphs.join(' ')), bullets: 0 };
    case 'cards':
      return { words: block.items.reduce((s, i) => s + countWords(i.title) + countWords(i.body), 0), bullets: block.items.length };
    case 'points':
      return { words: block.items.reduce((s, i) => s + countWords(i.label) + countWords(i.detail), 0), bullets: block.items.length };
    case 'steps':
      return { words: block.items.reduce((s, i) => s + countWords(i.title) + countWords(i.body), 0), bullets: block.items.length };
    case 'timeline':
      return { words: block.steps.reduce((s, i) => s + countWords(i.title) + countWords(i.body), 0), bullets: block.steps.length };
    case 'quote':
      return { words: countWords(block.text), bullets: 0 };
    case 'assumption':
      return { words: countWords(block.statement) + countWords(block.basis), bullets: 0 };
    case 'persona':
      return { words: countWords([...(block.traits ?? []), ...(block.needs ?? []), block.quote ?? ''].join(' ')), bullets: (block.traits?.length ?? 0) + (block.needs?.length ?? 0) };
    default:
      return { words: 0, bullets: 0 };
  }
}

/**
 * Les BUDGETS DE TEXTE d'une diapositive, par ce qu'elle fait : une ouverture se lit en un regard, une
 * page de points en quelques secondes, une page de données peut porter davantage (ce sont des chiffres
 * qu'on parcourt). Une page qui déborde change de représentation ou se divise — on ne réduit pas son corps
 * jusqu'à l'illisible.
 */
export const TEXT_BUDGETS = {
  statement: { headlineWords: 12, bodyWords: 30, maxBullets: 0 },
  points: { headlineWords: 12, bodyWords: 60, maxBullets: 4 },
  demonstration: { headlineWords: 12, bodyWords: 70, maxBullets: 5 },
  data: { headlineWords: 14, bodyWords: 90, maxBullets: 6 },
} as const satisfies Record<string, TextBudget>;
export type TextBudgetKind = keyof typeof TEXT_BUDGETS;

/** La charge de texte d'une page contre son budget : `over` > 1 quand elle le dépasse. */
export function textLoad(a: Pick<ContentAnalysis, 'words'>, budget?: TextBudget): { over: number; detail: string } {
  if (!budget) return { over: 0, detail: '' };
  const ratios = [a.words.headline / budget.headlineWords, budget.bodyWords ? a.words.body / budget.bodyWords : a.words.body ? 2 : 0, budget.maxBullets ? a.words.bullets / budget.maxBullets : 0];
  return { over: Math.max(...ratios), detail: `${a.words.headline}/${budget.headlineWords} mots de titre, ${a.words.body}/${budget.bodyWords} mots de corps, ${a.words.bullets}/${budget.maxBullets} points` };
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
    case 'points':
      // Une image (ou une pastille) par point, un libellé, une ligne : la hauteur d'une rangée illustrée.
      return 0.16 + Math.ceil(block.items.length / 3) * (block.items.some((i) => i.media) ? 0.2 : 0.1);
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
    case 'points':
      return block.items.length >= 3;
    default:
      return false;
  }
}

const HERO_KINDS = new Set<BlockKind>(['metrics', 'chart', 'figure', 'quote', 'points']);

/** La charge de texte d'une section, sans la composer (contrôle d'un rédacteur par l'hôte). */
export const sectionTextLoad = (section: SectionContent, budget?: TextBudget): { over: number; detail: string } => textLoad(analyzeSection(section), budget ?? section.intent?.textBudget);

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
    intent: section.intent,
    words: section.blocks.reduce(
      (acc, b) => {
        if (b.origin === 'system') return acc;
        const w = bodyWords(b);
        return { ...acc, body: acc.body + w.words, bullets: acc.bullets + w.bullets };
      },
      { headline: countWords(section.title), body: countWords(section.lede), bullets: 0 }
    ),
    hasFigure: section.blocks.some((b) => b.kind === 'figure'),
    hubPoints: section.blocks.some((b) => b.kind === 'points' && b.items.length >= 3 && b.items.length <= 6 && !b.items.some((i) => i.media)),
  };
}
