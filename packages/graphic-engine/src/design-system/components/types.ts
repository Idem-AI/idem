/**
 * Un COMPOSANT dessine un bloc de contenu : un tableau, des chiffres-clés, un graphique, un nuancier.
 *
 * Il déclare ce qu'il accepte (types de blocs), l'espace de ses VARIANTES (que le compositeur explore
 * pour varier les pages sans changer le contenu), une estimation de sa hauteur (pour planifier une page
 * fixe AVANT de la rendre) et son rendu. Il ne choisit jamais une couleur libre : il nomme des rôles,
 * le contexte les résout aux couleurs de la charte, au contraste garanti.
 */
import type { DocumentType } from '../../contracts/common';
import type { Block, BlockKind } from '../../contracts/content-model';
import type { CompileContext, Env } from '../../html-css-compiler/context';

export type VariantValue = string | number | boolean;
export type Variant = Record<string, VariantValue>;

export interface RenderInput<B extends Block = Block> {
  block: B;
  ctx: CompileContext;
  env: Env;
  variant: Variant;
}

export interface ComponentDef<B extends Block = Block> {
  /** Identifiant stable (`ui.table`) : c'est lui que le DesignSpec et les agents nomment. */
  id: string;
  kinds: BlockKind[];
  /** Une ligne pour le registre et les menus des agents. */
  summary: string;
  variants: Record<string, VariantValue[]>;
  defaults: Variant;
  /** Livrables où le composant a du sens (absent : tous). */
  deliverables?: DocumentType[];
  /** Largeur minimale utile (px, à l'échelle de la toile) : en dessous, on ne le pose pas dans cette colonne. */
  minWidth?: number;
  /** Hauteur estimée (px) dans cette largeur. */
  estimate(block: B, ctx: CompileContext, width: number, variant: Variant): number;
  /**
   * Composant ÉLASTIQUE (graphique, image, vitrine) : il s'étire sur la hauteur qu'on lui donne. Dans une
   * colonne de hauteur connue, il reçoit ce que les éléments rigides lui laissent, jamais moins que ce minimum.
   */
  elastic?: { minHeight: (block: B, ctx: CompileContext, width: number) => number };
  /** Le bloc se garde-t-il d'un seul tenant entre deux pages ? (défaut : oui) */
  atomic?(block: B, variant: Variant): boolean;
  render(input: RenderInput<B>): string;
}

/** Un composant typé pour UN type de bloc. */
export type ComponentFor<K extends BlockKind> = ComponentDef<Extract<Block, { kind: K }>>;
