/**
 * ContentModel — ce qu'un livrable DIT, sans un mot sur la façon de le montrer.
 *
 * C'est le renversement central, hérité du moteur précédent et durci : le modèle (ou le code)
 * écrit le contenu ; le moteur produit la page. Un contenu est une suite de SECTIONS (une page de
 * business plan, une diapositive, une page de charte, une face de carte, un visuel), chacune
 * portant des BLOCS typés. Chaque bloc a un identifiant stable : le DesignSpec le désigne par cet
 * identifiant et ne recopie jamais un texte.
 *
 * `origin: 'system'` marque ce que le code a posé à partir de données réelles (tableaux
 * financiers, nuancier, URL de logo) : le moteur le restitue à l'identique et le contrôle de
 * fidélité le vérifie. Un chiffre n'est jamais recopié par un modèle.
 */
import { z } from 'zod/v4';
import { DocumentType, Hex, Id, Locale, text, Url } from './common';
import { SlideIntent } from './slide-intent';

export const Origin = z.enum(['model', 'system']);
export type Origin = z.infer<typeof Origin>;

const base = { id: Id, origin: Origin.optional() };
const S = text; // alias court : texte non vide, borné

// ── Blocs rédigés (le modèle sait les produire) ────────────────────────────────────────────

export const ProseBlock = z.strictObject({
  ...base,
  kind: z.literal('prose'),
  paragraphs: z.array(S(2400)).min(1).max(24),
});

export const CardsBlock = z.strictObject({
  ...base,
  kind: z.literal('cards'),
  /** `emphasis` sort UNE carte du lot : sans elle, trois cartes identiques restent trois cartes identiques. */
  items: z.array(z.strictObject({ title: S(120), body: S(700), emphasis: z.boolean().optional() })).min(1).max(12),
});

export const TableBlock = z.strictObject({
  ...base,
  kind: z.literal('table'),
  headers: z.array(S(80)).min(1).max(10),
  rows: z.array(z.array(z.string().max(320)).min(1).max(10)).min(1).max(60),
  caption: S(240).optional(),
});

/** Chiffres-clés. `note` porte l'année, la source ou l'unité. */
export const MetricsBlock = z.strictObject({
  ...base,
  kind: z.literal('metrics'),
  items: z.array(z.strictObject({ value: S(32), label: S(96), note: S(96).optional() })).min(1).max(8),
});

/** Le type dit ce que la donnée EST (une part d'un tout, une évolution), pas ce qui est joli. */
export const ChartType = z.enum(['bar', 'groupedBar', 'stacked', 'horizontalBar', 'line', 'area', 'pie', 'doughnut', 'radar']);
export type ChartType = z.infer<typeof ChartType>;

export const ChartBlock = z
  .strictObject({
    ...base,
    kind: z.literal('chart'),
    chartType: ChartType,
    title: S(140).optional(),
    labels: z.array(S(48)).min(1).max(36),
    series: z.array(z.strictObject({ name: S(64), data: z.array(z.number()).min(1).max(36) })).min(1).max(8),
    /** Ce que le lecteur doit CONCLURE, pas ce que le graphique montre. */
    readingKey: S(240),
    unit: S(24).optional(),
  })
  .refine((c) => c.series.every((s) => s.data.length === c.labels.length), { message: 'chaque série doit avoir autant de valeurs que d’étiquettes', path: ['series'] });

export const QuoteBlock = z.strictObject({ ...base, kind: z.literal('quote'), text: S(600), attribution: S(120).optional() });

export const TimelineBlock = z.strictObject({
  ...base,
  kind: z.literal('timeline'),
  steps: z.array(z.strictObject({ date: S(40), title: S(120), body: S(500) })).min(2).max(10),
});

/** Hypothèse explicite : ce que le plan suppose, et sur quoi. */
export const AssumptionBlock = z.strictObject({ ...base, kind: z.literal('assumption'), statement: S(400), basis: S(500) });

/** Une image. `focal` : où est le sujet (0–1), pour que la composition recadre sans le couper. */
export const FigureBlock = z.strictObject({
  ...base,
  kind: z.literal('figure'),
  url: Url,
  alt: S(200),
  caption: S(240).optional(),
  focal: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
});

/** Un tableau à deux entrées : options en colonnes, critères en lignes. */
export const ComparisonBlock = z.strictObject({
  ...base,
  kind: z.literal('comparison'),
  columns: z.array(S(60)).min(2).max(5),
  rows: z.array(z.strictObject({ label: S(100), values: z.array(S(160)).min(2).max(5) })).min(1).max(12),
});

export const StepsBlock = z.strictObject({
  ...base,
  kind: z.literal('steps'),
  items: z.array(z.strictObject({ title: S(100), body: S(420) })).min(2).max(7),
});

export const SwotBlock = z.strictObject({
  ...base,
  kind: z.literal('swot'),
  strengths: z.array(S(200)).min(1).max(5),
  weaknesses: z.array(S(200)).min(1).max(5),
  opportunities: z.array(S(200)).min(1).max(5),
  threats: z.array(S(200)).min(1).max(5),
});

export const FunnelBlock = z.strictObject({
  ...base,
  kind: z.literal('funnel'),
  stages: z.array(z.strictObject({ label: S(80), value: S(32), note: S(100).optional() })).min(3).max(6),
});

export const PersonaBlock = z.strictObject({
  ...base,
  kind: z.literal('persona'),
  name: S(80),
  role: S(120),
  traits: z.array(S(120)).max(6).optional(),
  needs: z.array(S(160)).max(5).optional(),
  quote: S(240).optional(),
});

export const RiskMatrixBlock = z.strictObject({
  ...base,
  kind: z.literal('riskMatrix'),
  risks: z.array(z.strictObject({ label: S(120), likelihood: z.enum(['low', 'medium', 'high']), impact: z.enum(['low', 'medium', 'high']), mitigation: S(240).optional() })).min(1).max(9),
});

/** Les neuf cases d'un modèle économique, dans l'ordre de lecture du canevas. */
export const BusinessModelBlock = z.strictObject({
  ...base,
  kind: z.literal('businessModel'),
  cells: z.array(z.strictObject({ key: z.enum(['partners', 'activities', 'resources', 'value', 'relations', 'channels', 'segments', 'costs', 'revenues']), items: z.array(S(160)).min(1).max(4) })).min(3).max(9),
});

/**
 * Des POINTS que l'on MONTRE plutôt qu'on ne les décrit : un libellé court, un détail d'une ligne, et ce
 * que leur image doit représenter (`visual`, un ou deux noms concrets). Le code y pose l'icône locale
 * (`icon`) ou le média trouvé (`media`) — jamais le modèle. C'est la forme d'une diapositive qui illustre
 * trois difficultés au lieu de les écrire en trois paragraphes.
 */
export const PointsBlock = z.strictObject({
  ...base,
  kind: z.literal('points'),
  items: z
    .array(
      z.strictObject({
        label: S(80),
        detail: S(160).optional(),
        /** Un chiffre qui porte le point (« 92 % »), s'il y en a un. */
        value: S(32).optional(),
        /** Ce que l'image du point représente, en un ou deux noms concrets (« truck », « coffee beans »). */
        visual: S(60).optional(),
        icon: z.string().regex(/^[a-z0-9-]{1,64}$/).optional(),
        media: z.strictObject({ url: Url, alt: S(200) }).optional(),
      })
    )
    .min(2)
    .max(6),
});

// ── Blocs SPÉCIMENS (jamais produits par un modèle : posés par le code, valeurs exactes) ────

export const SwatchesBlock = z.strictObject({
  ...base,
  kind: z.literal('swatches'),
  items: z.array(z.strictObject({ hex: Hex, name: S(60), role: S(80).optional() })).min(1).max(16),
});

export const TypeSpecimenBlock = z.strictObject({
  ...base,
  kind: z.literal('typeSpecimen'),
  specimens: z.array(z.strictObject({ family: S(80), role: S(80), sample: S(240) })).min(1).max(4),
});

export const LogoDisplayBlock = z.strictObject({
  ...base,
  kind: z.literal('logoDisplay'),
  variants: z.array(z.strictObject({ url: Url, label: S(80), background: z.enum(['light', 'dark', 'neutral']) })).min(1).max(8),
});

export const TypeScaleBlock = z.strictObject({
  ...base,
  kind: z.literal('typeScale'),
  levels: z
    .array(
      z.strictObject({
        label: S(60),
        family: S(80),
        /** Un DEGRÉ de l'échelle du document : la taille réelle est celle que ce degré vaut dans CE document. */
        step: z.enum(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl']),
        weight: z.number().int().min(100).max(900),
        sample: S(160),
        usage: S(160).optional(),
      })
    )
    .min(2)
    .max(8),
});

export const PatternGridBlock = z.strictObject({
  ...base,
  kind: z.literal('patternGrid'),
  patterns: z
    .array(
      z.strictObject({
        name: S(60),
        motif: z.enum(['stripes', 'grid', 'dots', 'chevron', 'arcs', 'checker', 'weave', 'contours']),
        ink: Hex,
        ground: Hex,
        note: S(200).optional(),
        /** Le fichier SVG répétable de ce motif : la page montre le vrai actif. */
        url: Url.optional(),
        tile: z.number().min(8).max(400).optional(),
      })
    )
    .min(1)
    .max(8),
});

const Ground = z.enum(['primary', 'accent', 'dark', 'light']);

export const SocialPostsBlock = z.strictObject({
  ...base,
  kind: z.literal('socialPosts'),
  posts: z.array(z.strictObject({ platform: S(40), headline: S(160), kicker: S(60).optional(), ground: Ground, logoUrl: Url.optional() })).min(1).max(6),
});

export const SocialBannersBlock = z.strictObject({
  ...base,
  kind: z.literal('socialBanners'),
  banners: z.array(z.strictObject({ platform: S(40), ratio: S(24), headline: S(160), tagline: S(160).optional(), ground: Ground, logoUrl: Url.optional() })).min(1).max(6),
});

/** Mockups déjà rendus en image ; `ratio` (largeur / hauteur) répartit la largeur de la rangée. */
export const MockupShowcaseBlock = z.strictObject({
  ...base,
  kind: z.literal('mockupShowcase'),
  items: z.array(z.strictObject({ url: Url, label: S(80), caption: S(200).optional(), ratio: z.number().min(0.2).max(6) })).min(1).max(6),
});

export const LogoStoryBlock = z.strictObject({
  ...base,
  kind: z.literal('logoStory'),
  url: Url,
  label: S(80),
  background: z.enum(['light', 'dark', 'neutral']),
  points: z.array(z.strictObject({ label: S(60), text: S(400) })).min(1).max(5),
});

export const ArtDirectionStanceBlock = z.strictObject({
  ...base,
  kind: z.literal('artDirectionStance'),
  styleName: S(80),
  rationale: S(800),
  keywords: z.array(S(48)).min(1).max(10),
});

export const CompositionPrinciplesBlock = z.strictObject({
  ...base,
  kind: z.literal('compositionPrinciples'),
  density: z.enum(['airy', 'balanced', 'dense']),
  items: z.array(z.strictObject({ demo: z.enum(['grid', 'density', 'whitespace', 'signature']), label: S(60), text: S(400) })).min(1).max(4),
});

export const ImageryShowcaseBlock = z.strictObject({
  ...base,
  kind: z.literal('imageryShowcase'),
  imageUrl: Url.optional(),
  rows: z.array(z.strictObject({ label: S(60), value: S(300) })).min(1).max(8),
});

export const ArtDirectionRulesBlock = z.strictObject({
  ...base,
  kind: z.literal('artDirectionRules'),
  rows: z.array(z.strictObject({ label: S(60), value: S(300) })).min(1).max(8),
  dos: z.array(S(200)).max(8),
  donts: z.array(S(200)).max(8),
});

/** Références numérotées d'une section sourcée : injectées par le service, jamais écrites par un modèle. */
export const SourcesBlock = z.strictObject({
  ...base,
  kind: z.literal('sources'),
  label: S(80).optional(),
  items: z.array(z.strictObject({ index: z.number().int().min(1).max(999), title: S(200), url: z.string().min(1).max(2048), domain: S(120).optional(), description: S(300).optional() })).min(1).max(30),
});

// ── Blocs de VISUEL, de COUVERTURE et de CARTE ─────────────────────────────────────────────

/** Le texte d'un visuel : un titre, ce qui le complète, et rien d'autre (jamais de bouton ni de slogan inventé). */
export const CopyBlock = z.strictObject({
  ...base,
  kind: z.literal('copy'),
  kicker: S(60).optional(),
  headline: S(180),
  subhead: S(240).optional(),
  body: S(600).optional(),
  /** Une offre, en clair (« −30 % »). */
  offer: S(48).optional(),
  facts: z.array(z.strictObject({ label: S(40).optional(), text: S(120) })).max(5).optional(),
  quote: z.strictObject({ text: S(300), author: S(80).optional() }).optional(),
  footnote: S(160).optional(),
});

export const CoverBlock = z.strictObject({
  ...base,
  kind: z.literal('cover'),
  brandName: S(80),
  /** Sur-titre court (« Torréfaction artisanale »). */
  kicker: S(80).optional(),
  /** La promesse, en une phrase. */
  promise: S(200).optional(),
  documentLabel: S(60),
  detail: S(80).optional(),
  dateLabel: S(40).optional(),
});

export const CARD_FIELDS = ['fullName', 'jobTitle', 'email', 'phone', 'mobile', 'website', 'address', 'linkedin', 'companyName', 'tagline'] as const;
export type CardField = (typeof CARD_FIELDS)[number];

/**
 * Les champs d'une carte de visite. En mode `markers`, le moteur émet `{{champ}}` et
 * `data-field="champ"` (le gabarit est partagé entre les porteurs) ; en mode `values`, il écrit les
 * valeurs échappées.
 */
export const ContactBlock = z.strictObject({
  ...base,
  kind: z.literal('contact'),
  side: z.enum(['front', 'back']),
  fields: z.strictObject(Object.fromEntries(CARD_FIELDS.map((f) => [f, z.string().max(160).optional()])) as Record<CardField, z.ZodOptional<z.ZodString>>),
  binding: z.enum(['markers', 'values']),
});

export const Block = z.discriminatedUnion('kind', [
  ProseBlock,
  CardsBlock,
  TableBlock,
  MetricsBlock,
  ChartBlock,
  QuoteBlock,
  TimelineBlock,
  AssumptionBlock,
  FigureBlock,
  ComparisonBlock,
  StepsBlock,
  SwotBlock,
  FunnelBlock,
  PersonaBlock,
  RiskMatrixBlock,
  BusinessModelBlock,
  PointsBlock,
  SwatchesBlock,
  TypeSpecimenBlock,
  LogoDisplayBlock,
  TypeScaleBlock,
  PatternGridBlock,
  SocialPostsBlock,
  SocialBannersBlock,
  MockupShowcaseBlock,
  LogoStoryBlock,
  ArtDirectionStanceBlock,
  CompositionPrinciplesBlock,
  ImageryShowcaseBlock,
  ArtDirectionRulesBlock,
  SourcesBlock,
  CopyBlock,
  CoverBlock,
  ContactBlock,
]);
export type Block = z.infer<typeof Block>;
export type BlockKind = Block['kind'];

/**
 * Un bloc POSÉ PAR LE CODE de l'hôte (tableau financier, nuancier, références), avant normalisation :
 * sans identifiant — le moteur lui en donne un qui ne croise jamais ceux du modèle (`systemBlocks`).
 */
export type BlockDraft = Block extends infer B ? (B extends { id: string } ? Omit<B, 'id' | 'origin'> & { id?: string } : never) : never;

/** Le rôle d'une section dit à quoi elle sert, pas comment elle se dessine. */
export const SectionRole = z.enum(['cover', 'opening', 'narrative', 'data', 'comparison', 'process', 'closing', 'appendix', 'specimen', 'showcase', 'visual', 'card-face']);
export type SectionRole = z.infer<typeof SectionRole>;

export const SectionContent = z.strictObject({
  id: Id,
  role: SectionRole.optional(),
  /** Sur-titre court. La composition décide s'il est affiché — un par page suffit. */
  kicker: S(80).optional(),
  title: S(160),
  /** Une phrase qui ÉNONCE le constat. Jamais « dans cette section, nous allons… ». */
  lede: S(320).optional(),
  blocks: z.array(Block).max(40),
  /** Ce que la page doit faire comprendre et comment le montrer (stratégie visuelle, budget de texte, image). */
  intent: SlideIntent.optional(),
  /**
   * Les NOTES DE L'ORATEUR (diapositives) : ce qui se dit à l'oral — explications, contexte, sources. Jamais
   * montrées sur la page : « le détail va dans votre voix ». Le régime de texte y range ce qui déborde.
   */
  notes: S(4000).optional(),
});
export type SectionContent = z.infer<typeof SectionContent>;

export const ContentModel = z.strictObject({
  /** 1.1 : l'intention de page (`intent`) et le bloc `points`. Un contenu 1.0 reste valide. */
  version: z.enum(['1.0', '1.1']),
  documentType: DocumentType,
  locale: Locale,
  title: S(160).optional(),
  sections: z.array(SectionContent).min(1).max(80),
});
export type ContentModel = z.infer<typeof ContentModel>;

/** Les blocs que le MODÈLE peut produire : les spécimens, les visuels et les cartes viennent du code. */
export const MODEL_BLOCK_KINDS: ReadonlySet<BlockKind> = new Set<BlockKind>([
  'prose',
  'cards',
  'table',
  'metrics',
  'chart',
  'quote',
  'timeline',
  'assumption',
  'comparison',
  'steps',
  'swot',
  'funnel',
  'persona',
  'riskMatrix',
  'businessModel',
  'points',
]);

/** Les blocs qui n'ont de sens qu'avec une valeur EXACTE : le moteur les restitue à l'identique. */
export const SPECIMEN_BLOCK_KINDS: ReadonlySet<BlockKind> = new Set<BlockKind>([
  'swatches',
  'typeSpecimen',
  'logoDisplay',
  'typeScale',
  'patternGrid',
  'socialPosts',
  'socialBanners',
  'mockupShowcase',
  'logoStory',
  'artDirectionStance',
  'compositionPrinciples',
  'imageryShowcase',
  'artDirectionRules',
  'sources',
]);
