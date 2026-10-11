/**
 * LE LOGO IR — le contrat entre l'agent créatif et le moteur graphique.
 *
 * L'agent ne produit jamais un bloc de SVG libre : il DÉCRIT son intention dans cette structure
 * (formes, lettres, proportions, couleurs, variantes), et le moteur la construit de façon
 * déterministe. Une même description donne toujours le même SVG ; elle tient en quelques
 * centaines de tokens là où un SVG dessiné par le modèle en demandait plusieurs milliers ; et
 * elle reste modifiable après coup (une couche, un paramètre, une couleur) sans rien redessiner.
 *
 * Le contrat est versionné (`version`) et indépendant du fournisseur de modèle.
 *
 * Deux principes de robustesse, valables pour tout ce qu'un modèle écrit :
 *  - les nombres hors bornes sont RAMENÉS dans leurs bornes (jamais rejetés) : un modèle qui
 *    demande 14 pétales en obtient 12, pas une erreur ;
 *  - les clés inconnues sont ignorées, les valeurs absentes reçoivent leur défaut. Seule une
 *    structure impossible à interpréter (type de couche inconnu, identifiant en double) est refusée.
 *
 * Repère : les couches « symbole » sont dessinées dans une boîte de 0 à 100 (origine en haut à
 * gauche). Le moteur mesure l'encre réelle et recadre : l'auteur n'a pas à centrer.
 */
import { z } from 'zod';

export const LOGO_IR_VERSION = '1.0' as const;

/** Les onze catégories de logos. */
export const CONCEPT_TYPES = [
  'wordmark',
  'lettermark',
  'letterform',
  'pictorial',
  'abstract',
  'mascot',
  'combination',
  'emblem',
  'dynamic',
  'minimal',
  'negative-space',
] as const;
export type ConceptType = (typeof CONCEPT_TYPES)[number];

// ─── Briques de base ─────────────────────────────────────────────────────────

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Un nombre qui accepte « 12 » et se ramène dans [min, max]. Non numérique : refusé. */
const num = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v),
    z.number().finite().transform((v) => clamp(v, min, max))
  );

/** Un entier ramené dans [min, max]. */
const int = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v),
    z.number().finite().transform((v) => clamp(Math.round(v), min, max))
  );

/** Coordonnée dans la boîte de dessin (large marge : une forme peut déborder avant recadrage). */
const coord = num(-200, 300);

const HEX = /^#[0-9a-fA-F]{6}$/;
const normalizeHex = (value: string) => {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  return v.toLowerCase();
};
export const HexColor = z.preprocess(
  (v) => (typeof v === 'string' ? normalizeHex(v) : v),
  z.string().regex(HEX, 'couleur hexadécimale #rrggbb attendue')
);

/** Rôles de couleur de la palette. `paper` est le fond : une couche `paper` est une DÉCOUPE (transparente). */
export const COLOR_ROLES = ['ink', 'ink2', 'accent', 'paper'] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];
export const ColorRef = z.union([z.enum(COLOR_ROLES), HexColor]);
export type ColorRefValue = z.infer<typeof ColorRef>;

const Id = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/, 'identifiant de couche : lettre puis lettres, chiffres, _ ou -');

// ─── Style ──────────────────────────────────────────────────────────────────

export const StrokeSchema = z.object({
  color: ColorRef.default('ink'),
  width: num(0.5, 24).default(4),
  cap: z.enum(['butt', 'round', 'square']).default('round'),
  join: z.enum(['miter', 'round', 'bevel']).default('round'),
});
export type LogoStroke = z.infer<typeof StrokeSchema>;

/**
 * Transformation d'une couche, appliquée autour de `origin` (le centre de la couche par défaut).
 * Ordre : miroir → échelle → inclinaison → rotation → translation.
 */
export const TransformSchema = z.object({
  x: num(-300, 300).optional(),
  y: num(-300, 300).optional(),
  rotate: num(-360, 360).optional(),
  scale: z.union([num(0.05, 8), z.tuple([num(0.05, 8), num(0.05, 8)])]).optional(),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  skewX: num(-45, 45).optional(),
  origin: z.tuple([coord, coord]).optional(),
});
export type LogoTransform = z.infer<typeof TransformSchema>;

// ─── Géométrie des formes ───────────────────────────────────────────────────

const Point = z.tuple([coord, coord]);

export const GeometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rect'), x: coord, y: coord, w: num(0.5, 400), h: num(0.5, 400), r: num(0, 200).default(0) }),
  z.object({ type: z.literal('circle'), cx: coord, cy: coord, r: num(0.5, 300) }),
  z.object({ type: z.literal('ellipse'), cx: coord, cy: coord, rx: num(0.5, 300), ry: num(0.5, 300) }),
  /** Polygone régulier (3 à 12 côtés), angles arrondis en option. */
  z.object({
    type: z.literal('polygon'),
    cx: coord,
    cy: coord,
    r: num(0.5, 300),
    sides: int(3, 12),
    rotation: num(-360, 360).default(0),
    cornerRadius: num(0, 60).default(0),
  }),
  z.object({
    type: z.literal('star'),
    cx: coord,
    cy: coord,
    outer: num(1, 300),
    inner: num(0.5, 300),
    points: int(3, 12),
    rotation: num(-360, 360).default(0),
  }),
  /** Anneau plein (couronne). */
  z.object({ type: z.literal('ring'), cx: coord, cy: coord, r: num(1, 300), thickness: num(0.5, 150) }),
  /** Bande d'anneau entre deux angles (0° = haut, sens horaire). */
  z.object({
    type: z.literal('arc'),
    cx: coord,
    cy: coord,
    r: num(1, 300),
    thickness: num(0.5, 150),
    from: num(-360, 720),
    to: num(-360, 720),
    round: z.boolean().default(false),
  }),
  /** Carré arrondi « app » (n = 2 ellipse, 4 squircle, grand = carré). */
  z.object({ type: z.literal('superellipse'), cx: coord, cy: coord, rx: num(1, 300), ry: num(1, 300), n: num(2, 8).default(4) }),
  /** Trait épais (rectangle à bouts droits ou ronds). */
  z.object({ type: z.literal('line'), x1: coord, y1: coord, x2: coord, y2: coord, width: num(0.5, 80), round: z.boolean().default(false) }),
  /** Polygone libre (2 à 64 sommets), angles arrondis en option. */
  z.object({ type: z.literal('poly'), points: z.array(Point).min(3).max(64), cornerRadius: num(0, 60).default(0) }),
  /** Tracé libre (commandes M L H V C S Q T A Z). Réservé aux crans qui autorisent le dessin d'auteur. */
  z.object({ type: z.literal('path'), d: z.string().min(4).max(6000) }),
]);
export type LogoGeometry = z.infer<typeof GeometrySchema>;

// ─── Texte ──────────────────────────────────────────────────────────────────

/** Effets typographiques : une seule idée par logotype (doctrine du prompt historique). */
export const TextEffectSchema = z.discriminatedUnion('type', [
  /** Point d'accent après le mot. */
  z.object({ type: z.literal('dot'), color: ColorRef.optional(), shape: z.enum(['circle', 'diamond', 'square']).default('circle') }),
  /** Filet sous le mot, sur une part de sa largeur. */
  z.object({ type: z.literal('underline'), color: ColorRef.optional(), span: num(0.15, 1).default(0.42) }),
  /** Barre verticale qui ouvre le mot. */
  z.object({ type: z.literal('bar'), color: ColorRef.optional() }),
  /** Coupe horizontale à travers tout le mot. */
  z.object({ type: z.literal('slice'), at: num(0.3, 0.7).default(0.5), gap: num(0.02, 0.2).default(0.06) }),
  /** Lettres voisines qui se chevauchent et fusionnent. */
  z.object({ type: z.literal('ligature'), overlap: num(0.05, 0.4).default(0.18) }),
  /** Remplace le point des « i » / « j » par une forme. */
  z.object({ type: z.literal('dotReplace'), shape: z.enum(['circle', 'diamond', 'square', 'triangle', 'leaf']).default('circle'), color: ColorRef.optional() }),
  /** Coupe en biais un angle d'une lettre. */
  z.object({ type: z.literal('cutCorner'), index: int(0, 47), corner: z.enum(['tl', 'tr', 'bl', 'br']).default('tr'), size: num(0.1, 0.6).default(0.3) }),
  /** Colore une seule lettre. */
  z.object({ type: z.literal('accentChar'), index: int(0, 47), color: ColorRef.default('accent') }),
  /** Incline le mot (dynamisme). */
  z.object({ type: z.literal('italic'), angle: num(4, 20).default(10) }),
  /** Remplace une lettre ronde (o, O, 0) par un disque plein ou un anneau. */
  z.object({ type: z.literal('swapRound'), index: int(0, 47), with: z.enum(['disc', 'ring']).default('disc'), color: ColorRef.optional() }),
]);
export type LogoTextEffect = z.infer<typeof TextEffectSchema>;

// ─── Couches ────────────────────────────────────────────────────────────────

const BaseLayer = {
  id: Id,
  /**
   * `symbol` et `frame` vivent dans la boîte de dessin 0–100 ; `wordmark` et `tagline` sont
   * posés par la composition (sauf si la couche donne `at`, auquel cas elle fait partie du symbole).
   */
  role: z.enum(['symbol', 'frame', 'wordmark', 'tagline']).default('symbol'),
  fill: z.union([ColorRef, z.literal('none')]).default('ink'),
  stroke: StrokeSchema.optional(),
  opacity: num(0.1, 1).optional(),
  transform: TransformSchema.optional(),
  hidden: z.boolean().optional(),
};

export const ShapeLayerSchema = z.object({ kind: z.literal('shape'), ...BaseLayer, geometry: GeometrySchema });

export const TextLayerSchema = z.object({
  kind: z.literal('text'),
  ...BaseLayer,
  role: z.enum(['symbol', 'frame', 'wordmark', 'tagline']).default('wordmark'),
  content: z.string().min(1).max(48),
  font: z
    .object({
      role: z.enum(['display', 'body']).default('display'),
      weight: int(100, 900).default(700),
      /** Famille imposée (rare) ; absente, celle de la charte. */
      family: z.string().max(60).optional(),
    })
    .default({ role: 'display', weight: 700 }),
  /** Interlettrage en em. */
  tracking: num(-0.1, 0.6).default(0),
  case: z.enum(['none', 'upper', 'lower', 'title']).default('none'),
  /** Placement dans la boîte de dessin (centre du texte) : fait du texte une partie du symbole. */
  at: z.object({ x: coord, y: coord }).optional(),
  /** Hauteur de capitale, dans la boîte de dessin (avec `at` ou `curve`). */
  size: num(2, 80).optional(),
  /** Texte sur un arc de cercle (emblèmes). `start` : angle du milieu du texte, 0° = haut. */
  curve: z
    .object({
      radius: num(5, 200),
      start: num(-360, 360).default(0),
      side: z.enum(['top', 'bottom']).default('top'),
    })
    .optional(),
  effects: z.array(TextEffectSchema).max(3).optional(),
});

export const GeneratorLayerSchema = z.object({
  kind: z.literal('generator'),
  ...BaseLayer,
  /** Identifiant d'un générateur du catalogue (voir `render/generators.ts`). */
  generator: z.string().min(1).max(40),
  /** Paramètres du générateur : ramenés dans leurs bornes par le moteur, inconnus ignorés. */
  params: z.record(z.union([z.number(), z.string(), z.boolean()])).default({}),
  seed: int(0, 999999).optional(),
});

export type ShapeLayer = z.infer<typeof ShapeLayerSchema>;
export type TextLayer = z.infer<typeof TextLayerSchema>;
export type GeneratorLayer = z.infer<typeof GeneratorLayerSchema>;

export const BOOLEAN_OPS = ['union', 'subtract', 'intersect', 'exclude'] as const;
export type BooleanOp = (typeof BOOLEAN_OPS)[number];
export const REPEAT_MODES = ['radial', 'mirror-x', 'mirror-y', 'mirror-xy', 'linear', 'grid'] as const;

type LayerBase = {
  id: string;
  role: 'symbol' | 'frame' | 'wordmark' | 'tagline';
  fill: ColorRefValue | 'none';
  stroke?: LogoStroke;
  opacity?: number;
  transform?: LogoTransform;
  hidden?: boolean;
};

/** Découpes, masques, espace négatif : le premier opérande est la base, les autres s'y appliquent. */
export type BooleanLayer = LayerBase & { kind: 'boolean'; op: BooleanOp; operands: LogoLayer[] };
/** Répétition d'une couche : rosace, miroir, rangée, grille. */
export type RepeatLayer = LayerBase & {
  kind: 'repeat';
  mode: (typeof REPEAT_MODES)[number];
  count: number;
  /** Rayon (radial), pas (linear/grid), en unités de la boîte. */
  radius: number;
  /** Sommets fondus en une seule forme. */
  merge: boolean;
  child: LogoLayer;
};
export type GroupLayer = LayerBase & { kind: 'group'; children: LogoLayer[] };

export type LogoLayer = ShapeLayer | TextLayer | GeneratorLayer | BooleanLayer | RepeatLayer | GroupLayer;

type LayerSchemaType = z.ZodType<LogoLayer, z.ZodTypeDef, unknown>;

const BooleanBase = z.object({ kind: z.literal('boolean'), ...BaseLayer, op: z.enum(BOOLEAN_OPS) });
const RepeatBase = z.object({
  kind: z.literal('repeat'),
  ...BaseLayer,
  mode: z.enum(REPEAT_MODES),
  count: int(2, 24).default(6),
  radius: num(0, 200).default(30),
  merge: z.boolean().default(false),
});
const GroupBase = z.object({ kind: z.literal('group'), ...BaseLayer });

/** Une couche, de n'importe quel type (récursif : booléens, répétitions et groupes en contiennent d'autres). */
export const LayerSchema: LayerSchemaType = z.lazy(() =>
  z.discriminatedUnion('kind', [
    ShapeLayerSchema,
    TextLayerSchema,
    GeneratorLayerSchema,
    BooleanBase.extend({ operands: z.array(LayerSchema).min(2).max(8) }),
    RepeatBase.extend({ child: LayerSchema }),
    GroupBase.extend({ children: z.array(LayerSchema).min(1).max(24) }),
  ])
) as LayerSchemaType;

// ─── Composition & variantes ────────────────────────────────────────────────

export const CompositionSchema = z.object({
  /** `auto` : horizontal si un symbole et un nom coexistent, sinon ce qui existe. */
  layout: z.enum(['auto', 'horizontal', 'stacked', 'symbol-only', 'wordmark-only']).default('auto'),
  /** Espace entre symbole et nom, en fraction de la hauteur du symbole. */
  gap: num(0.05, 1.2).default(0.3),
  /** Hauteur du symbole ÷ hauteur de capitale du nom. */
  symbolScale: num(1, 6).optional(),
  align: z.enum(['center', 'start']).default('center'),
  /** Marge autour du logo, en fraction de sa plus petite dimension. */
  padding: num(0.02, 0.4).default(0.1),
  /** Part de la hauteur de capitale du nom occupée par la ligne d'accroche. */
  taglineScale: num(0.25, 0.8).default(0.42),
});
export type LogoComposition = z.infer<typeof CompositionSchema>;

export const VARIANT_KINDS = ['primary', 'monochrome', 'inverted', 'symbol', 'wordmark', 'dynamic'] as const;
export type VariantKind = (typeof VARIANT_KINDS)[number];

/** Retouche d'une couche pour une variante (système dynamique, ou couleur propre à un fond). */
export const LayerOverrideSchema = z.object({
  fill: z.union([ColorRef, z.literal('none')]).optional(),
  hidden: z.boolean().optional(),
  params: z.record(z.union([z.number(), z.string(), z.boolean()])).optional(),
  transform: TransformSchema.optional(),
});
export type LayerOverride = z.infer<typeof LayerOverrideSchema>;

export const VariantSchema = z.object({
  id: Id,
  kind: z.enum(VARIANT_KINDS),
  label: z.string().max(60).optional(),
  /** Couleur unique des variantes monochromes ; absente : noir sur fond clair, blanc sur fond sombre. */
  color: HexColor.optional(),
  /** Fond sur lequel la variante est destinée. */
  background: z.enum(['light', 'dark']).optional(),
  overrides: z.record(LayerOverrideSchema).optional(),
});
export type LogoVariant = z.infer<typeof VariantSchema>;

// ─── Document ───────────────────────────────────────────────────────────────

export const BriefSchema = z.object({
  brandName: z.string().min(1).max(60),
  tagline: z.string().max(60).optional(),
  industry: z.string().max(120).default(''),
  audience: z.string().max(160).default(''),
  personality: z.array(z.string().max(30)).max(6).default([]),
});

export const PaletteSchema = z.object({
  ink: HexColor,
  ink2: HexColor.optional(),
  accent: HexColor.optional(),
});
export type LogoPalette = z.infer<typeof PaletteSchema>;

export const ConceptSchema = z.object({
  type: z.enum(CONCEPT_TYPES),
  /** L'idée en une ou deux phrases : ce que le logo dit de la marque. */
  rationale: z.string().max(400).default(''),
  /** Les motifs choisis (générateurs, lettres) : sert à mesurer la diversité entre propositions. */
  motifs: z.array(z.string().max(40)).max(6).default([]),
  /** Recette du planificateur qui a produit ce document (absente d'un dessin libre). */
  recipe: z.string().max(60).optional(),
});

export const CanvasSchema = z.object({
  width: int(64, 4000).default(1200),
  /** `auto` : la hauteur suit le contenu. */
  height: z.union([int(32, 4000), z.literal('auto')]).default('auto'),
});

export const DEFAULT_VARIANTS: LogoVariant[] = [
  { id: 'primary', kind: 'primary', background: 'light' },
  { id: 'monochrome', kind: 'monochrome', background: 'light' },
  { id: 'inverted', kind: 'inverted', background: 'dark' },
  { id: 'symbol', kind: 'symbol' },
];

export const LogoDocumentSchema = z
  .object({
    version: z.literal(LOGO_IR_VERSION).default(LOGO_IR_VERSION),
    brief: BriefSchema,
    concept: ConceptSchema,
    canvas: CanvasSchema.default({ width: 1200, height: 'auto' }),
    palette: PaletteSchema,
    composition: CompositionSchema.default({}),
    layers: z.array(LayerSchema).min(1).max(24),
    variants: z.array(VariantSchema).max(12).default(DEFAULT_VARIANTS),
    meta: z.object({ seed: int(0, 4294967295).default(1), engine: z.string().max(40).optional() }).default({ seed: 1 }),
  })
  .superRefine((doc, ctx) => {
    const seen = new Set<string>();
    let count = 0;
    const visit = (layer: LogoLayer, path: (string | number)[]) => {
      count += 1;
      if (seen.has(layer.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `identifiant de couche en double : « ${layer.id} »` });
      seen.add(layer.id);
      if (layer.kind === 'boolean') layer.operands.forEach((child, i) => visit(child, [...path, 'operands', i]));
      if (layer.kind === 'repeat') visit(layer.child, [...path, 'child']);
      if (layer.kind === 'group') layer.children.forEach((child, i) => visit(child, [...path, 'children', i]));
    };
    doc.layers.forEach((layer, i) => visit(layer, ['layers', i]));
    if (count > 48) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layers'], message: `${count} couches (48 au plus) : le logo est trop complexe` });
    const variantIds = new Set<string>();
    doc.variants.forEach((variant, i) => {
      if (variantIds.has(variant.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants', i, 'id'], message: `variante en double : « ${variant.id} »` });
      variantIds.add(variant.id);
    });
  });

/** Un logo tel que le moteur le lit (valeurs par défaut posées, nombres bornés). */
export type LogoDocument = z.output<typeof LogoDocumentSchema>;
/** Un logo tel qu'un auteur l'écrit (tout ce qui a un défaut est facultatif). */
export type LogoDocumentInput = z.input<typeof LogoDocumentSchema>;

// ─── Lecture ────────────────────────────────────────────────────────────────

export interface ParseResult {
  ok: boolean;
  doc?: LogoDocument;
  /** Une ligne par défaut, réinjectable dans un prompt de correction. */
  errors: string[];
}

/** Valide et normalise un document. Ne lève jamais. */
export function parseLogoDocument(input: unknown): ParseResult {
  const parsed = LogoDocumentSchema.safeParse(input);
  if (parsed.success) return { ok: true, doc: parsed.data, errors: [] };
  const errors = parsed.error.issues.slice(0, 8).map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`);
  return { ok: false, errors };
}

/** Visite toutes les couches (profondeur d'abord), opérandes et enfants compris. */
export function walkLayers(layers: LogoLayer[], visit: (layer: LogoLayer, parent?: LogoLayer) => void, parent?: LogoLayer): void {
  for (const layer of layers) {
    visit(layer, parent);
    if (layer.kind === 'boolean') walkLayers(layer.operands, visit, layer);
    else if (layer.kind === 'repeat') walkLayers([layer.child], visit, layer);
    else if (layer.kind === 'group') walkLayers(layer.children, visit, layer);
  }
}

export function findLayer(doc: Pick<LogoDocument, 'layers'>, id: string): LogoLayer | undefined {
  let found: LogoLayer | undefined;
  walkLayers(doc.layers, (layer) => {
    if (!found && layer.id === id) found = layer;
  });
  return found;
}
