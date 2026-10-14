/**
 * DesignSpec — ce qui est gardé d'une page : le CODE écrit par l'auteur (HTML Tailwind), avec ses clés
 * `{{…}}` et ses primitives encore en place.
 *
 * Rejouer ce code avec un contenu retouché refait la page sans modèle (textes, chiffres, photo) ; une retouche
 * ÉCRITE (« titre plus grand ») le donne à l'auteur avec la consigne. Les plans de la version 1 (arbres de
 * primitives typées) ne se rejouent plus : une page de cette époque est réécrite.
 *
 * Les jetons nommés (espaces, rayons, densité…) restent : ils décrivent les directions artistiques du catalogue
 * et l'échelle de la marque (`design-system/tokens`).
 */
import { z } from 'zod/v4';
import { CreativityLevel, DocumentType, FormatId, Id } from './common';

// ── Jetons (catalogue de directions, échelle de la marque) ───────────────────────────────────

export const Space = z.enum(['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']);
export const Radius = z.enum(['none', 'sm', 'md', 'lg', 'pill']);
export const Stroke = z.enum(['none', 'hair', 'thin', 'thick']);
/** Les degrés de l'échelle typographique du document. */
export const TextSize = z.enum(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl']);
export const Density = z.enum(['airy', 'balanced', 'dense']);
export const ColorStrategy = z.enum(['monochrome-accent', 'duotone', 'inverse', 'brand-full', 'split-complementary', 'image-extracted']);
export const TypeMood = z.enum(['neutral', 'wide-whisper', 'weight-clash', 'lowercase', 'tight-display', 'outline-mix', 'staggered', 'letter-anchor']);
export const Tension = z.enum(['calm', 'hero-space', 'corner-anchor', 'framed', 'layered', 'bleed', 'diagonal', 'ruled']);
export const Accent = z.enum(['none', 'underline', 'border', 'shape', 'pattern', 'mark', 'dots', 'wash']);

export type SpaceToken = z.infer<typeof Space>;
export type RadiusToken = z.infer<typeof Radius>;
export type StrokeToken = z.infer<typeof Stroke>;
export type TextSizeToken = z.infer<typeof TextSize>;
export type Density = z.infer<typeof Density>;
export type ColorStrategy = z.infer<typeof ColorStrategy>;
export type TypeMood = z.infer<typeof TypeMood>;
export type Tension = z.infer<typeof Tension>;
export type Accent = z.infer<typeof Accent>;

// ── La page gardée ───────────────────────────────────────────────────────────────────────────

export const SectionSpec = z.strictObject({
  version: z.literal(2),
  /** La section de contenu que ce code met en page. */
  ref: Id,
  /** Toujours `authored` : gardé pour les appelants qui lisent `spec.pattern.id`. */
  pattern: z.strictObject({ id: z.string().max(48) }),
  /** Le fragment de l'auteur, assaini : classes Tailwind, clés `{{…}}`, primitives `<idem-…>`. */
  html: z.string().max(400_000),
  /** La bible du document au moment de l'écriture. */
  bible: z.string().max(2400).optional(),
  /** Le cran qui l'a écrite. */
  level: CreativityLevel.optional(),
});
export type SectionSpec = z.infer<typeof SectionSpec>;

/** Une page gardée par ce moteur (version 2), et non un plan de l'ancien moteur. */
export function isAuthoredSpec(spec: unknown): spec is SectionSpec {
  return Boolean(spec && typeof spec === 'object' && (spec as { version?: unknown }).version === 2 && typeof (spec as { html?: unknown }).html === 'string' && (spec as { html: string }).html.trim());
}

export const DesignSpec = z.strictObject({
  version: z.literal(2),
  documentType: DocumentType,
  format: FormatId,
  creativity: CreativityLevel,
  bible: z.string().max(2400).optional(),
  /** L'identité des jetons pour lesquels les pages ont été écrites (marque, direction, format). */
  tokensHash: z.string().max(32),
  seed: z.string().max(120),
  engine: z.strictObject({ version: z.string().max(16), components: z.string().max(16) }),
  sections: z.array(SectionSpec).max(80),
});
export type DesignSpec = z.infer<typeof DesignSpec>;
