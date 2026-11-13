/**
 * L'AIGUILLEUR — choisit, par le code, la variante de chaque section (visuel prêt ou non, nombre d'éléments, variété
 * dans le site, graine stable du projet), l'assemble avec le contenu rédigé, puis la fait passer par la même
 * vérification qu'un composant écrit (`reviewComponent` : correction, forme, montage jsdom, faits). Une variante
 * refusée cède sa place à la suivante ; aucune ne passe → `null`, et la section repart vers l'auteur de code.
 */
import crypto from 'node:crypto';
import { reviewComponent, withoutClaims, type Review, type ReviewContext, type ReviewTarget } from '../authoring.js';
import { ChatLogger } from '../../utils/logger.js';
import { assembleSection, assembleShell, type ActionValue } from './assemble.js';
import type { SectionContent } from './copy.js';
import type { LoadedSectionCatalog, SectionNode, ShellNode } from './types.js';

/** Un nombre stable tiré d'un texte : la même construction choisit les mêmes variantes (reprise, régénération). */
export function seedOf(text: string): number {
  return crypto.createHash('sha1').update(text).digest().readUInt32BE(0);
}

/** Le contenu ramené à ce que la variante sait mettre en page, ou null si elle ne le peut pas. */
export function fitContent(node: SectionNode, content: SectionContent, visuals: number): SectionContent | null {
  if (node.visual === 'required' && !visuals) return null;
  const out: SectionContent = { ...content };
  for (const [list, [min, max]] of Object.entries(node.fits ?? {})) {
    if (list === 'gallery') {
      if (visuals < min) return null;
      continue;
    }
    const items = Array.isArray(out[list]) ? (out[list] as unknown[]) : [];
    if (items.length < min) return null;
    if (items.length > max) out[list] = items.slice(0, max);
  }
  return out;
}

/** Les variantes d'une composition, dans l'ordre où les essayer. */
/**
 * Les nœuds de la DA de la marque ; aucun : ceux de ses voisines ; aucun non plus : tous (un site ne s'arrête jamais
 * faute de couverture). Sans DA connue, aucun filtre.
 */
export function inDirection<T extends { directions?: string[] }>(catalog: LoadedSectionCatalog, list: T[], direction?: string): T[] {
  if (!direction || !catalog.directions?.size || !catalog.directions.has(direction)) return list;
  const own = list.filter((n) => n.directions?.includes(direction));
  if (own.length) return own;
  const neighbors = catalog.directions.get(direction)?.neighbors ?? [];
  const near = list.filter((n) => n.directions?.some((d) => neighbors.includes(d)));
  return near.length ? near : list;
}

export function rankVariants(catalog: LoadedSectionCatalog, layout: string, visuals: number, used: Map<string, number>, seed: number, direction?: string): SectionNode[] {
  const pool = inDirection(catalog, catalog.sections.filter((s) => s.layout === layout), direction);
  const score = (s: SectionNode, i: number) => {
    // Avec un visuel prêt, une variante qui le montre ; sans, une variante qui n'en attend pas.
    const visualFit = visuals ? (s.visual === 'none' ? 2 : 0) : s.visual === 'optional' ? 1 : 0;
    return (used.get(s.id) ?? 0) * 10 + visualFit * 3 + ((seed + i * 2654435761) % 1000) / 1000;
  };
  return pool.map((s, i) => ({ s, k: score(s, i) })).sort((a, b) => a.k - b.k).map((x) => x.s);
}

export interface ComposeOptions {
  catalog: LoadedSectionCatalog;
  review: ReviewContext;
  target: ReviewTarget;
  component: string;
  id: string;
  layout: string;
  opening: boolean;
  content: SectionContent;
  mediaKeys: string[];
  resolveHref: (action: ActionValue) => string | null;
  /** Les variantes déjà employées dans ce site (la variété se décide au fil des sections). */
  used: Map<string, number>;
  seed: number;
  label: string;
  /** La DA de la marque : seules ses variantes (ou celles de ses voisines) sont essayées. */
  direction?: string;
}

export interface Composed {
  code: string;
  variant: string;
  fixes: string[];
}

export async function composeSection(o: ComposeOptions): Promise<Composed | null> {
  const ranked = rankVariants(o.catalog, o.layout, o.mediaKeys.length, o.used, o.seed, o.direction);
  const tried: string[] = [];
  for (const node of ranked) {
    const content = fitContent(node, o.content, o.mediaKeys.length);
    if (!content) continue;
    let code: string;
    try {
      code = assembleSection(node.template, { component: o.component, id: o.id, opening: o.opening, content, mediaKeys: o.mediaKeys, resolveHref: o.resolveHref });
    } catch (error) {
      tried.push(`${node.id} : ${(error as Error).message}`);
      continue;
    }
    // Réservée avant la vérification : deux sections vérifiées en même temps ne prennent pas la même variante.
    o.used.set(node.id, (o.used.get(node.id) ?? 0) + 1);
    let review: Review = await reviewComponent(code, o.review, o.target);
    if (!review.problems.length && review.invented.length) review = await withoutClaims(review, o.review, o.target);
    if (review.problems.length || review.empty) {
      o.used.set(node.id, (o.used.get(node.id) ?? 1) - 1);
      tried.push(`${node.id} : ${review.empty ? "n'affiche rien" : review.problems.slice(0, 2).join(' · ')}`);
      continue;
    }
    return { code: review.code, variant: node.id, fixes: review.fixes };
  }
  ChatLogger.warn('SITE_CATALOG', `${o.label} : aucune variante du catalogue ne passe`, { layout: o.layout, tried });
  return null;
}

/** L'en-tête ou le pied de page : un gabarit du catalogue, vérifié comme le reste ; null si aucun ne passe. */
export async function composeShell(shells: ShellNode[], review: ReviewContext, target: ReviewTarget, seed: number, label: string): Promise<Composed | null> {
  if (!shells.length) return null;
  const start = seed % shells.length;
  const order = shells.map((_, i) => shells[(start + i) % shells.length]);
  const tried: string[] = [];
  for (const node of order) {
    let code: string;
    try {
      code = assembleShell(node.template);
    } catch (error) {
      tried.push(`${node.id} : ${(error as Error).message}`);
      continue;
    }
    const checked = await reviewComponent(code, review, target);
    if (checked.problems.length || checked.empty) {
      tried.push(`${node.id} : ${checked.problems.slice(0, 2).join(' · ') || "n'affiche rien"}`);
      continue;
    }
    return { code: checked.code, variant: node.id, fixes: checked.fixes };
  }
  ChatLogger.warn('SITE_CATALOG', `${label} : aucun gabarit du catalogue ne passe`, { tried });
  return null;
}
