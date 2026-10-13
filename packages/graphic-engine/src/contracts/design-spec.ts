/**
 * DesignSpec — le plan graphique d'un livrable, sans une ligne de HTML.
 *
 * Le contrat entre ceux qui DÉCIDENT (le code, ou un agent qui choisit dans un menu) et ceux qui
 * DESSINENT (le compilateur). Une section est un ARBRE de primitives typées (pile, rangée, grille,
 * calques, texte, bloc de contenu, image, forme…) dont toutes les valeurs de style sont des
 * JETONS nommés (`md`, `brand`, `ink`) : jamais du CSS libre, jamais un texte recopié — un bloc de
 * contenu est désigné par son identifiant.
 *
 * Cette forme est ce qui rend un plan validable SANS modèle et SANS HTML : on sait avant de
 * rendre si chaque référence existe, si l'arbre est raisonnable, si le composant accepte ce bloc.
 * Elle rend aussi un rendu REJOUABLE : même spec, même contenu, mêmes jetons ⇒ même page.
 */
import { z } from 'zod/v4';
import { CreativityLevel, DocumentType, FormatId, Id, Params, text, Url } from './common';

// ── Jetons ─────────────────────────────────────────────────────────────────────────────────

export const Space = z.enum(['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']);
export const Surface = z.enum(['none', 'ground', 'raised', 'sunken', 'brand', 'brand-soft', 'accent', 'accent-soft', 'ink', 'inverse']);
/**
 * Les encres sont relatives à la SURFACE où elles se posent : le compilateur garantit leur contraste.
 * `heading`, `kicker` et `emphasis` désignent les rôles de la page que la stratégie de couleur a résolus.
 */
export const Ink = z.enum(['ink', 'muted', 'faint', 'heading', 'kicker', 'emphasis', 'brand', 'accent', 'on-brand', 'on-accent', 'inverse']);
export const Radius = z.enum(['none', 'sm', 'md', 'lg', 'pill']);
export const Stroke = z.enum(['none', 'hair', 'thin', 'thick']);
export const Align = z.enum(['start', 'center', 'end', 'stretch']);
export const Justify = z.enum(['start', 'center', 'end', 'between']);
export const TextRole = z.enum(['overline', 'kicker', 'display', 'title', 'subtitle', 'lede', 'body', 'small', 'caption', 'label', 'figure', 'note', 'quote', 'number', 'folio', 'tagline', 'cta']);
/** Les degrés de l'échelle typographique du document (le dernier, `6xl`, est réservé aux couvertures et aux visuels). */
export const TextSize = z.enum(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl']);

export type SpaceToken = z.infer<typeof Space>;
export type SurfaceToken = z.infer<typeof Surface>;
export type InkToken = z.infer<typeof Ink>;
export type RadiusToken = z.infer<typeof Radius>;
export type StrokeToken = z.infer<typeof Stroke>;
export type TextRoleToken = z.infer<typeof TextRole>;
export type TextSizeToken = z.infer<typeof TextSize>;
export type AlignToken = z.infer<typeof Align>;
export type JustifyToken = z.infer<typeof Justify>;

// ── Les dimensions de style : chacune est LUE par le compilateur ou les patterns ───────────

export const Density = z.enum(['airy', 'balanced', 'dense']);
export const ColorStrategy = z.enum(['monochrome-accent', 'duotone', 'inverse', 'brand-full', 'split-complementary', 'image-extracted']);
export const TypeMood = z.enum(['neutral', 'wide-whisper', 'weight-clash', 'lowercase', 'tight-display', 'outline-mix', 'staggered', 'letter-anchor']);
export const Tension = z.enum(['calm', 'hero-space', 'corner-anchor', 'framed', 'layered', 'bleed', 'diagonal', 'ruled']);
export const Accent = z.enum(['none', 'underline', 'border', 'shape', 'pattern', 'mark', 'dots', 'wash']);

export type Density = z.infer<typeof Density>;
export type ColorStrategy = z.infer<typeof ColorStrategy>;
export type TypeMood = z.infer<typeof TypeMood>;
export type Tension = z.infer<typeof Tension>;
export type Accent = z.infer<typeof Accent>;

// ── Les nœuds ──────────────────────────────────────────────────────────────────────────────

const Pad = z.union([
  Space,
  z.strictObject({ x: Space.optional(), y: Space.optional(), t: Space.optional(), r: Space.optional(), b: Space.optional(), l: Space.optional() }),
]);

const Border = z.strictObject({
  weight: Stroke,
  sides: z.array(z.enum(['t', 'r', 'b', 'l'])).min(1).max(4).optional(),
  ink: Ink.optional(),
});

/** Ce que partagent les conteneurs : marge intérieure, surface, bordure, rayon, croissance. */
const containerStyle = {
  id: Id.optional(),
  pad: Pad.optional(),
  surface: Surface.optional(),
  border: Border.optional(),
  radius: Radius.optional(),
  /** Occupe l'espace restant de son parent. */
  grow: z.boolean().optional(),
  /** Ne se coupe jamais entre deux pages (`data-keep-together`, lu par le paginateur). */
  keep: z.boolean().optional(),
  /** Rogne ce qui dépasse. */
  clip: z.boolean().optional(),
  /** Rôle structurel : `folio` (pied de section, que le paginateur peut retirer seul sur sa page), `header`, `body`, `aside`. */
  role: z.enum(['header', 'body', 'aside', 'folio']).optional(),
  /** À fond perdu : le conteneur s'étend jusqu'aux bords de la page de ces côtés (bandeau, rail, panneau). */
  bleed: z.array(z.enum(['t', 'r', 'b', 'l'])).min(1).max(4).optional(),
};

export const SHAPE_IDS = [
  'rings',
  'quarter-circles',
  'half-discs',
  'stripes',
  'grid-lines',
  'dots-field',
  'chevrons',
  'arcs',
  'blob',
  'waves',
  'steps',
  'triangles',
  'cross-marks',
  'checker',
  'contours',
  'burst',
  'slant',
] as const;
export const ShapeId = z.enum(SHAPE_IDS);
export type ShapeId = z.infer<typeof ShapeId>;

export const ShapeTone = z.enum(['brand', 'accent', 'ink', 'soft', 'on-brand']);

const At = z.strictObject({ x: z.number().min(-20).max(120), y: z.number().min(-20).max(120), w: z.number().min(0).max(140), h: z.number().min(0).max(140) });

export type NodeT =
  | ({ t: 'stack'; gap?: z.infer<typeof Space>; align?: z.infer<typeof Align>; justify?: z.infer<typeof Justify>; children: NodeT[] } & ContainerStyleT)
  | ({ t: 'row'; gap?: z.infer<typeof Space>; align?: z.infer<typeof Align>; justify?: z.infer<typeof Justify>; wrap?: boolean; children: NodeT[] } & ContainerStyleT)
  | ({ t: 'grid'; cols: number | number[]; gap?: z.infer<typeof Space>; rowGap?: z.infer<typeof Space>; align?: z.infer<typeof Align>; spans?: number[]; children: NodeT[] } & ContainerStyleT)
  | ({ t: 'box'; children: NodeT[] } & ContainerStyleT)
  | { t: 'layer'; id?: string; surface?: z.infer<typeof Surface>; clip?: boolean; items: { at: z.infer<typeof At>; z?: number; node: NodeT }[] }
  | {
      t: 'text';
      id?: string;
      role: z.infer<typeof TextRole>;
      /** Une référence dans le contenu (`title`, `kicker`, `lede`, `b3.paragraphs.0`) — jamais le texte lui-même… */
      ref?: string;
      /** … sauf pour une légende de décor que le moteur écrit lui-même (numéro de page, mention). */
      text?: string;
      ink?: z.infer<typeof Ink>;
      align?: 'start' | 'center' | 'end';
      size?: z.infer<typeof TextSize>;
      weight?: number;
      caps?: 'none' | 'upper' | 'lower';
      tracking?: 'tight' | 'normal' | 'wide' | 'wider';
      leading?: 'tight' | 'normal' | 'loose';
      maxLines?: number;
      /** Champ de carte de visite : le moteur émet `{{champ}}` et `data-field`. */
      bind?: string;
      emphasis?: 'underline' | 'outline';
      rotate?: 'up' | 'down';
    }
  | { t: 'block'; id?: string; ref: string; component?: string; variant?: Record<string, string | number | boolean>; span?: number }
  | { t: 'image'; id?: string; ref?: string; url?: string; alt?: string; fit?: 'cover' | 'contain'; focal?: { x: number; y: number }; radius?: z.infer<typeof Radius>; overlay?: 'none' | 'scrim-bottom' | 'scrim-top' | 'scrim-full' | 'tint-brand'; ratio?: number; grow?: boolean }
  | { t: 'shape'; id?: string; shape: ShapeId; seed?: number; tone?: z.infer<typeof ShapeTone>; opacity?: number; size?: 'fill' | 'sm' | 'md' | 'lg' }
  | { t: 'icon'; id?: string; name: string; set?: string; size?: 'sm' | 'md' | 'lg'; ink?: z.infer<typeof Ink> }
  | { t: 'logo'; id?: string; variant?: 'auto' | 'light' | 'dark' | 'mono' | 'icon'; height?: 'sm' | 'md' | 'lg' | 'xl' }
  | { t: 'rule'; id?: string; weight?: z.infer<typeof Stroke>; ink?: z.infer<typeof Ink>; length?: 'full' | 'short' | 'xshort'; vertical?: boolean }
  | { t: 'spacer'; size?: z.infer<typeof Space>; flex?: boolean }
  | { t: 'pattern'; id?: string; opacity?: number };

interface ContainerStyleT {
  id?: string;
  pad?: z.infer<typeof Pad>;
  surface?: z.infer<typeof Surface>;
  border?: z.infer<typeof Border>;
  radius?: z.infer<typeof Radius>;
  grow?: boolean;
  keep?: boolean;
  clip?: boolean;
  role?: 'header' | 'body' | 'aside' | 'folio';
  bleed?: Array<'t' | 'r' | 'b' | 'l'>;
}

export const Node: z.ZodType<NodeT> = z.lazy(() =>
  z.discriminatedUnion('t', [
    z.strictObject({ t: z.literal('stack'), gap: Space.optional(), align: Align.optional(), justify: Justify.optional(), ...containerStyle, children: z.array(Node).max(40) }),
    z.strictObject({ t: z.literal('row'), gap: Space.optional(), align: Align.optional(), justify: Justify.optional(), wrap: z.boolean().optional(), ...containerStyle, children: z.array(Node).max(40) }),
    z.strictObject({
      t: z.literal('grid'),
      cols: z.union([z.number().int().min(1).max(12), z.array(z.number().min(1).max(12)).min(1).max(12)]),
      gap: Space.optional(),
      rowGap: Space.optional(),
      align: Align.optional(),
      spans: z.array(z.number().int().min(1).max(12)).max(40).optional(),
      ...containerStyle,
      children: z.array(Node).max(40),
    }),
    z.strictObject({ t: z.literal('box'), ...containerStyle, children: z.array(Node).max(40) }),
    z.strictObject({
      t: z.literal('layer'),
      id: Id.optional(),
      surface: Surface.optional(),
      clip: z.boolean().optional(),
      items: z.array(z.strictObject({ at: At, z: z.number().int().min(0).max(20).optional(), node: Node })).max(24),
    }),
    z.strictObject({
      t: z.literal('text'),
      id: Id.optional(),
      role: TextRole,
      ref: z.string().max(96).optional(),
      text: text(240).optional(),
      ink: Ink.optional(),
      align: z.enum(['start', 'center', 'end']).optional(),
      size: TextSize.optional(),
      weight: z.number().int().min(100).max(900).optional(),
      caps: z.enum(['none', 'upper', 'lower']).optional(),
      tracking: z.enum(['tight', 'normal', 'wide', 'wider']).optional(),
      leading: z.enum(['tight', 'normal', 'loose']).optional(),
      maxLines: z.number().int().min(1).max(20).optional(),
      bind: z.string().max(32).optional(),
      emphasis: z.enum(['underline', 'outline']).optional(),
      rotate: z.enum(['up', 'down']).optional(),
    }),
    z.strictObject({ t: z.literal('block'), id: Id.optional(), ref: Id, component: z.string().max(64).optional(), variant: Params.optional(), span: z.number().int().min(1).max(12).optional() }),
    z.strictObject({
      t: z.literal('image'),
      id: Id.optional(),
      ref: Id.optional(),
      url: Url.optional(),
      alt: text(200).optional(),
      fit: z.enum(['cover', 'contain']).optional(),
      focal: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
      radius: Radius.optional(),
      overlay: z.enum(['none', 'scrim-bottom', 'scrim-top', 'scrim-full', 'tint-brand']).optional(),
      ratio: z.number().min(0.2).max(6).optional(),
      grow: z.boolean().optional(),
    }),
    z.strictObject({ t: z.literal('shape'), id: Id.optional(), shape: ShapeId, seed: z.number().int().min(0).max(9999).optional(), tone: ShapeTone.optional(), opacity: z.number().min(0).max(1).optional(), size: z.enum(['fill', 'sm', 'md', 'lg']).optional() }),
    z.strictObject({ t: z.literal('icon'), id: Id.optional(), name: z.string().min(1).max(64), set: z.string().max(32).optional(), size: z.enum(['sm', 'md', 'lg']).optional(), ink: Ink.optional() }),
    z.strictObject({ t: z.literal('logo'), id: Id.optional(), variant: z.enum(['auto', 'light', 'dark', 'mono', 'icon']).optional(), height: z.enum(['sm', 'md', 'lg', 'xl']).optional() }),
    z.strictObject({ t: z.literal('rule'), id: Id.optional(), weight: Stroke.optional(), ink: Ink.optional(), length: z.enum(['full', 'short', 'xshort']).optional(), vertical: z.boolean().optional() }),
    z.strictObject({ t: z.literal('spacer'), size: Space.optional(), flex: z.boolean().optional() }),
    z.strictObject({ t: z.literal('pattern'), id: Id.optional(), opacity: z.number().min(0).max(1).optional() }),
  ])
) as z.ZodType<NodeT>;

export type Node = NodeT;

// ── La section et le document ──────────────────────────────────────────────────────────────

/**
 * Un décor de page : posé en absolu, enfant DIRECT de la racine. Le paginateur des documents les tient
 * pour des décorations et les reproduit sur chaque page qu'il construit ; ils ne portent jamais de sens
 * (`aria-hidden`) et ne passent jamais sous un texte avec une opacité qui le gênerait.
 */
export const DecorItem = z.strictObject({
  /** Position et taille en POURCENTAGE de la page (débord admis jusqu'à −20 % / 120 %). */
  at: At,
  z: z.number().int().min(0).max(5).optional(),
  node: Node,
});
export type DecorItem = z.infer<typeof DecorItem>;

export const SectionSpec = z.strictObject({
  /** La section de contenu que ce plan met en page. */
  ref: Id,
  pattern: z.strictObject({ id: Id, params: Params.optional() }),
  density: Density,
  strategy: ColorStrategy,
  mood: TypeMood,
  tension: Tension,
  accent: Accent,
  /** Fond de la page (jeton) : `ground` sauf pour une page d'inversion. */
  ground: Surface.optional(),
  /** L'arbre complet : la VÉRITÉ du rendu (rejouable même si les patterns évoluent). */
  root: Node,
  decor: z.array(DecorItem).max(10).optional(),
});
export type SectionSpec = z.infer<typeof SectionSpec>;

export const Direction = z.strictObject({
  /** Un style du catalogue de directions artistiques (`swiss`, `editorial`, `minimalism`…). */
  styleId: z.string().max(40).optional(),
  keywords: z.array(z.string().max(48)).max(10).optional(),
});

export const DesignSpec = z.strictObject({
  version: z.literal('1.0'),
  documentType: DocumentType,
  format: FormatId,
  creativity: CreativityLevel,
  direction: Direction,
  /** L'identité des jetons pour lesquels ce plan a été composé (marque, direction, format). */
  tokensHash: z.string().max(32),
  /** La graine du document : un classement est toujours semé par le PROJET, jamais par un numéro de page. */
  seed: z.string().max(120),
  engine: z.strictObject({ version: z.string().max(16), components: z.string().max(16) }),
  sections: z.array(SectionSpec).min(1).max(80),
});
export type DesignSpec = z.infer<typeof DesignSpec>;
