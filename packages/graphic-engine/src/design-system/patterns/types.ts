/**
 * Un MOTIF de composition (pattern) : une recette qui, à partir du contenu analysé, du look et de
 * paramètres, construit l'ARBRE d'une page. Ce n'est pas un gabarit figé : ses paramètres forment un
 * espace que le moteur de composition explore, et la même recette produit des silhouettes différentes.
 *
 * Un motif déclare aussi les RÉGIONS qu'il occupe (en % de la page) : la silhouette d'une composition se
 * calcule ainsi AVANT le rendu, et la diversité se mesure sans dessiner tous les candidats.
 */
import type { SectionContent, SectionRole } from '../../contracts/content-model';
import type { DecorItem, NodeT, SurfaceToken } from '../../contracts/design-spec';
import type { Params, ParamValue } from '../../contracts/common';
import type { BlockInfo, ContentAnalysis } from '../../composition-engine/analyze';
import type { Rng } from '../../foundation/rng';
import type { SectionMeta } from '../../html-css-compiler/context';
import type { Variant } from '../components/types';
import type { FormatDef, FormatFamily } from '../formats';
import type { Look } from '../look';
import type { DesignTokens } from '../tokens';

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'header' | 'body' | 'figure' | 'band' | 'aside' | 'decor';
}

export interface PatternContext {
  section: SectionContent;
  analysis: ContentAnalysis;
  tokens: DesignTokens;
  look: Look;
  format: FormatDef;
  params: Params;
  meta: SectionMeta;
  rng: Rng;
  /** La variante de composant retenue pour ce bloc (semée, cohérente avec le look). */
  variant: (block: BlockInfo, width?: number) => Variant;
}

export interface PatternBuild {
  root: NodeT;
  decor?: DecorItem[];
  ground?: SurfaceToken;
}

export interface PatternDef {
  id: string;
  family: FormatFamily;
  summary: string;
  /** Affinités de style (`calm`, `bold`, `editorial`, `structured`, `playful`…), lues par le classement. */
  tags: string[];
  /** Rôles de section admis (absent : tous sauf couverture et face de carte). */
  roles?: SectionRole[];
  params: Record<string, ParamValue[]>;
  /** Adéquation au contenu : 0 = ne convient pas, 1 = idéal. */
  fit(analysis: ContentAnalysis, format: FormatDef): number;
  regions(params: Params, analysis: ContentAnalysis): Region[];
  build(ctx: PatternContext): PatternBuild;
}
