/**
 * Le contexte du compilateur : ce qu'un nœud doit savoir pour devenir du HTML.
 *
 * La résolution des ENCRES est relative à la SURFACE courante : un texte `ink` posé sur un panneau de
 * couleur de marque reçoit l'encre lisible sur CE panneau, garantie au seuil (7:1 pour l'encre
 * principale, 4,5:1 pour le reste, 3:1 pour un grand texte décoratif). Un motif de composition ne peut
 * donc pas produire un texte illisible : il nomme une intention, le compilateur garantit le contraste.
 */
import type { DocumentType, Issue } from '../contracts/common';
import type { SectionContent } from '../contracts/content-model';
import type { InkToken, NodeT, SurfaceToken } from '../contracts/design-spec';
import { contrastRatio, isDark, mixHex, readableInk } from '../foundation/color';
import type { Look } from '../design-system/look';
import { readableBrand } from '../design-system/look';
import type { DesignTokens } from '../design-system/tokens';

export interface Env {
  /** Couleur du fond sous ce nœud. */
  surface: string;
  /** Largeur disponible (px). */
  width: number;
  /** Hauteur disponible, quand elle est connue (toiles fixes). */
  height?: number;
}

export interface SectionMeta {
  brandName: string;
  /** Mention du document (« Business plan », « Charte graphique »…). */
  documentLabel?: string;
  /** Rang de la section dans le document (1…n) et nombre total. */
  index?: number;
  total?: number;
  /** Le pied de page du document (décidé une fois pour tout le document) : complet, logo seul, aucun. */
  footer?: 'full' | 'logo' | 'none';
}

export interface CompileContext {
  tokens: DesignTokens;
  look: Look;
  section: SectionContent;
  documentType: DocumentType;
  locale: string;
  /** Cartes de visite : `{{champ}}` (gabarit partagé) ou valeurs. */
  bindings: 'values' | 'markers';
  meta: SectionMeta;
  issues: Issue[];
  /** Identifiants uniques dans la page (définitions SVG, dégradés). */
  uid: (prefix: string) => string;
  /** Rendu d'une icône par le registre de capacités (local d'abord) ; absent : pas d'icône. */
  icons?: (node: Extract<NodeT, { t: 'icon' }>, env: Env) => string;
  /** Échelle du corps d'une toile fixe (réparation mesurée) : le pied de page la compense. */
  fitScale?: number;
}

/** Les encres : celles du contrat (dont les rôles de la page que le look a résolus). */
export type InkSpec = InkToken;

export function surfaceHex(token: SurfaceToken | undefined, ctx: CompileContext, parent: string): string {
  const c = ctx.tokens.color;
  switch (token) {
    case undefined:
    case 'none':
      return parent;
    case 'ground':
      return ctx.look.ground;
    case 'raised':
      return ctx.look.inverted ? mixHex(ctx.look.ground, ctx.look.ink, 0.1) : c.raised;
    case 'sunken':
      return ctx.look.inverted ? mixHex(ctx.look.ground, '#000000', 0.12) : c.sunken;
    case 'brand':
      return c.neonPrimary ? c.deep : c.primary;
    case 'brand-soft':
      return ctx.look.inverted ? mixHex(ctx.look.ground, ctx.look.ink, 0.14) : ctx.look.panel === c.raised ? c.brandSoft : ctx.look.panel;
    case 'accent':
      return c.neonAccent ? c.accentSoft : c.accent;
    case 'accent-soft':
      return c.accentSoft;
    case 'ink':
      return c.deep;
    case 'inverse':
      return isDark(parent) ? c.ground : c.deep;
  }
}

const near = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/**
 * Une encre pour ce fond. `large` : un grand texte (≥ 24 px, ou ≥ 18,7 px gras) se contente de 3:1 ;
 * l'encre principale vise toujours 7:1.
 */
export function inkHex(spec: InkSpec | undefined, ctx: CompileContext, surface: string, large = false): string {
  const c = ctx.tokens.color;
  const onPage = near(surface, ctx.look.ground);
  const body = large ? 3 : 4.5;
  switch (spec ?? 'ink') {
    case 'ink':
      return onPage ? ctx.look.ink : readableInk(isDark(surface) ? c.onDeep : c.ink, surface, 7);
    case 'muted':
      return onPage ? ctx.look.muted : readableInk(mixHex(inkHex('ink', ctx, surface), surface, 0.3), surface, 4.5);
    case 'faint':
      return readableInk(mixHex(inkHex('ink', ctx, surface), surface, 0.45), surface, 3);
    case 'heading':
      return onPage ? ctx.look.heading : inkHex('ink', ctx, surface);
    case 'kicker':
      return onPage ? ctx.look.kicker : inkHex('muted', ctx, surface);
    case 'emphasis':
      return onPage ? ctx.look.emphasis : readableBrand(c.neonPrimary ? c.deep : c.primary, surface, 3);
    case 'brand': {
      const brand = c.neonPrimary ? c.deep : c.primary;
      if (near(surface, brand)) return c.onBrand;
      return contrastRatio(brand, surface) >= body ? brand : readableBrand(brand, surface, body);
    }
    case 'accent': {
      const accent = c.neonAccent ? (c.accentRamp['800'] ?? c.deep) : c.accent;
      if (near(surface, c.accent)) return c.onAccent;
      return contrastRatio(accent, surface) >= body ? accent : readableBrand(accent, surface, body);
    }
    case 'on-brand':
      return readableInk(c.onBrand, surface, body);
    case 'on-accent':
      return readableInk(c.onAccent, surface, body);
    case 'inverse':
      return isDark(surface) ? readableInk(c.ground, surface, 7) : readableInk(c.deep, surface, 7);
  }
}

export function createContext(input: Omit<CompileContext, 'uid' | 'issues'> & { issues?: Issue[] }): CompileContext {
  let counter = 0;
  const prefix = input.section.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 's';
  return { ...input, issues: input.issues ?? [], uid: (p: string) => `ge${prefix}${p}${++counter}` };
}
