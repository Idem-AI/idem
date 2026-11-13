/**
 * LA DIRECTION ARTISTIQUE D'UNE MARQUE, COMPOSÉE DEPUIS LE CATALOGUE — jamais rédigée par un modèle.
 *
 * Décision du 11/11/2026 : l'agent de la charte CHOISIT une DA du catalogue (`idem-templates/catalog/directions`) et une
 * déclinaison par champ ; ce module en tire la direction de la marque, mot pour mot. Seuls deux textes viennent de
 * l'agent, et aucun n'est un élément de direction : la raison du choix (montrée dans la charte) et les sujets des
 * images de la marque (ce qu'on photographie, propre à son activité).
 */
import { getDirection, pickVariant, selectableDirections, type DirectionNode, type DirectionVariantField } from '@idem/graphic-engine';
import type { ArtDirectionModel } from './art-direction.model';

export const DIRECTION_FIELDS: DirectionVariantField[] = ['tagline', 'keywords', 'grid', 'whitespace', 'signatureMove', 'recipes', 'color', 'typography', 'imagery', 'graphicDevices'];

/** Les déclinaisons choisies, ramenées à des identifiants existants (un identifiant inconnu prend la première). */
export function normalizePicks(d: DirectionNode, picks: Record<string, unknown> | undefined): Record<DirectionVariantField, string> {
  return Object.fromEntries(DIRECTION_FIELDS.map((f) => [f, pickVariant(d, f, typeof picks?.[f] === 'string' ? (picks[f] as string) : undefined).id])) as Record<DirectionVariantField, string>;
}

export function composeArtDirection(d: DirectionNode, picks: Record<string, unknown> | undefined, extra: { rationale?: string; subjects?: string; catalogVersion?: string } = {}): ArtDirectionModel {
  const ids = normalizePicks(d, picks);
  const v = <F extends DirectionVariantField>(f: F) => pickVariant(d, f, ids[f]);
  const grid = v('grid');
  const color = v('color');
  const typo = v('typography');
  const imagery = v('imagery');
  return {
    styleId: d.id,
    styleName: d.name.fr,
    tagline: v('tagline').text,
    rationale: (extra.rationale || '').trim().slice(0, 600) || d.essence.fr,
    keywords: v('keywords').items,
    layout: { grid: grid.text, density: grid.density, whitespace: v('whitespace').text, signatureMove: v('signatureMove').text, recipes: v('recipes').items },
    color: { distribution: color.distribution, application: color.application, contrast: color.contrast },
    typography: { scaleContrast: typo.scaleContrast, caseAndTracking: typo.caseAndTracking, treatment: typo.treatment },
    imagery: { medium: imagery.medium, subjects: (extra.subjects || '').trim().slice(0, 240), treatment: imagery.treatment, lighting: imagery.lighting, framing: imagery.framing },
    graphicDevices: v('graphicDevices').items,
    dos: d.dos,
    donts: d.donts,
    imagePromptModifier: d.image.modifier,
    variants: ids,
    ...(extra.catalogVersion ? { catalogVersion: extra.catalogVersion } : {}),
    inspirations: d.inspirations,
    updatedAt: new Date(),
  };
}

/**
 * Une direction déjà enregistrée, remise d'accord avec le catalogue : sa DA et ses déclinaisons sont relues, les textes
 * se recomposent (une fiche corrigée dans le dépôt corrige toutes les marques). Une DA disparue garde l'ancienne
 * direction telle quelle.
 */
export function recomposeArtDirection(saved: ArtDirectionModel): ArtDirectionModel {
  const d = getDirection(saved.styleId);
  if (!d) return saved;
  return { ...composeArtDirection(d, saved.variants, { rationale: saved.rationale, subjects: saved.imagery?.subjects, catalogVersion: saved.catalogVersion }), ...(saved.id ? { id: saved.id } : {}), ...(saved.createdAt ? { createdAt: saved.createdAt } : {}) };
}

/**
 * Les deux réponses de l'agent (DA, puis déclinaisons) → la direction de la marque. Un identifiant hors catalogue,
 * à fond sombre imposé ou écarté ne passe jamais : repli sur l'éditorial (ou la première DA proposable).
 */
export function directionFromReplies(
  first: { styleId?: unknown; rationale?: unknown } | null | undefined,
  second: { variants?: Record<string, unknown>; subjects?: unknown } | null | undefined,
  o: { excluded?: string[]; catalogVersion?: string } = {}
): { direction: ArtDirectionModel; requested: string; styleId: string } {
  const allowed = selectableDirections()
    .map((d) => d.id)
    .filter((id) => !(o.excluded ?? []).includes(id));
  const requested = String(first?.styleId ?? '').trim().toLowerCase();
  const styleId = allowed.includes(requested) ? requested : allowed.includes('editorial') ? 'editorial' : allowed[0];
  const node = getDirection(styleId)!;
  const direction = composeArtDirection(node, second?.variants, {
    rationale: typeof first?.rationale === 'string' ? first.rationale : '',
    subjects: typeof second?.subjects === 'string' ? second.subjects : '',
    catalogVersion: o.catalogVersion,
  });
  return { direction, requested, styleId };
}
