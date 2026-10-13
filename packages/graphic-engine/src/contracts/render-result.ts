/**
 * RenderResult — ce que le moteur rend : le HTML, d'où il vient, ce qu'on a mesuré, ce qui reste
 * à signaler et ce que cela a coûté.
 *
 * Il est versionné et porte l'identité de tout ce qui a servi à produire la page (moteur,
 * bibliothèque de composants, DesignSpec, jetons) : une modification ultérieure du document sait
 * ainsi avec QUOI il a été fabriqué.
 */
import { z } from 'zod/v4';
import { DocumentType, FormatId, Id, Issue } from './common';

export const Measured = z.strictObject({
  width: z.number(),
  height: z.number(),
  /** Part de la hauteur occupée par le contenu, 0..1 (pages à hauteur fixe). */
  fill: z.number().min(0).max(1.5).optional(),
  /** Pixels de débordement après réparation (0 = aucun). */
  overflowPx: z.number().optional(),
  /** Plus petit contraste texte/fond lu dans le DOM. */
  minContrast: z.number().optional(),
  /** Silhouette de la page : occupation de la grille 12×8, sans couleur, de `0` à `9`. */
  silhouette: z.string().max(120).optional(),
});

export const Repair = z.strictObject({
  code: z.string().max(48),
  detail: z.string().max(240),
  /** `code` : corrigé par le moteur ; `agent` : corrigé par un modèle (jamais au-dessous du cran qui l'admet). */
  by: z.enum(['code', 'agent']),
});

export const Usage = z.strictObject({
  /** Tâches confiées à un modèle (0 aux crans où le code décide tout). */
  agentCalls: z.number().int().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  ms: z.number().min(0),
});

export const RenderResult = z.strictObject({
  version: z.literal('1.0'),
  documentType: DocumentType,
  format: FormatId,
  sectionId: Id.optional(),
  /** Un fragment autonome : sa racine porte `data-ge-*` (moteur, motif, empreinte). */
  html: z.string(),
  /** Le bloc à poser dans le `<head>` de l'assembleur (polices) — absent si les polices sont système. */
  head: z.string().optional(),
  provenance: z.strictObject({
    engine: z.string(),
    components: z.string(),
    specHash: z.string(),
    tokensHash: z.string(),
    pattern: z.string(),
    /** Empreinte structurelle : sert la mémoire de diversité (jamais le HTML complet). */
    fingerprint: z.string(),
  }),
  measured: Measured.optional(),
  repairs: z.array(Repair),
  /** Constats `blocking` restants (la page est fausse) puis `advisory` (perfectible). */
  issues: z.array(Issue),
  usage: Usage,
});
export type RenderResult = z.infer<typeof RenderResult>;
export type Measured = z.infer<typeof Measured>;
export type Repair = z.infer<typeof Repair>;
export type Usage = z.infer<typeof Usage>;
