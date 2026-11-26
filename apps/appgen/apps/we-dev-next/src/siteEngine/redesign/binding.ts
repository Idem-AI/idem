/**
 * CHAQUE IMAGE AVEC SON ÉLÉMENT — par le code, après la rédaction, jamais par la position.
 *
 * Les sections du catalogue qui illustrent une liste (équipe, projets, services, cartes, articles) posent le visuel
 * n°i sur l'élément n°i. Or l'ordre des éléments vient du rédacteur, et celui des visuels du relevé, du tri ou de
 * l'agent média : deux ordres indépendants. Sur une page d'équipe, une seule photo écartée ou déplacée décalait toutes
 * les autres, et chaque nom recevait le visage d'un autre (relevé le 26/11/2026 sur une vraie refonte).
 *
 * Le relevé garde désormais, pour chaque image, le texte qui l'accompagnait sur l'ancien site (`caption` : nom et rôle
 * sous la photo, titre du projet). Ici, chaque image légendée est rattachée à l'élément rédigé qui reprend les mots
 * DISTINCTIFS de sa légende (un nom, un titre — pas « co-founder », que partagent deux légendes), une image par
 * élément au plus. Puis :
 *
 *   - les éléments qui ont trouvé leur image passent en tête, dans l'ordre du rédacteur, chacun avec la sienne ;
 *   - les autres suivent, sans image — ou avec une image SANS légende (une photo d'ambiance ne trompe personne) ;
 *   - une image légendée qui ne retrouve pas son élément n'est posée nulle part : mieux vaut un membre sans photo
 *     qu'un membre avec le visage d'un autre.
 *
 * Aucune image légendée, ou aucune correspondance : rien ne change (comportement d'avant).
 */
import type { MediaAsset } from '../media/mediaPipeline.js';
import type { SectionContent } from '../sectionCatalog/copy.js';

/** Mots trop communs pour distinguer deux éléments (fr / en). */
const STOP = new Set(
  'les des une pour avec dans sur par aux est son ses nos vos notre votre leur plus the and for with our your from that this are was more savoir voir lire read learn'.split(' ')
);

function tokensOf(text: string): Set<string> {
  return new Set(
    text
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3 && !STOP.has(token))
  );
}

/** Le texte d'un élément rédigé : une chaîne, ou les chaînes d'un objet (nom, rôle, titre…). */
function itemText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object')
    return Object.values(item as Record<string, unknown>)
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
  return '';
}

export interface Binding {
  content: SectionContent;
  assets: MediaAsset[];
  /** Le champ de liste réordonné (`members`, `projects`…). */
  list: string;
  matched: number;
  /** Les images légendées qu'aucun élément n'a reprises (retirées). */
  dropped: number;
  /** Quelque chose a bougé : la section doit être recomposée. */
  changed: boolean;
}

/** L'appariement image ↔ élément d'une liste ; `null` s'il n'y a rien à faire. */
function pair(items: unknown[], assets: MediaAsset[]): Map<number, number> {
  const captioned = assets.map((asset, index) => ({ index, tokens: asset.caption ? tokensOf(asset.caption) : null })).filter((a) => a.tokens && a.tokens.size);
  // Le poids d'un mot : 1 s'il n'appartient qu'à une légende, ½ s'il en touche deux… (« founder » ne distingue rien).
  const spread = new Map<string, number>();
  for (const a of captioned) for (const token of a.tokens!) spread.set(token, (spread.get(token) ?? 0) + 1);
  const itemTokens = items.map((item) => tokensOf(itemText(item)));
  const pairs: { item: number; asset: number; score: number }[] = [];
  for (const a of captioned)
    itemTokens.forEach((tokens, item) => {
      let score = 0;
      for (const token of a.tokens!) if (tokens.has(token)) score += 1 / spread.get(token)!;
      // Au moins un mot qui n'appartient qu'à cette légende (un nom, un titre).
      if (score >= 1) pairs.push({ item, asset: a.index, score });
    });
  pairs.sort((x, y) => y.score - x.score || x.item - y.item);
  const byItem = new Map<number, number>();
  const taken = new Set<number>();
  for (const p of pairs) {
    if (byItem.has(p.item) || taken.has(p.asset)) continue;
    byItem.set(p.item, p.asset);
    taken.add(p.asset);
  }
  return byItem;
}

export function bindMediaToItems(content: SectionContent, assets: MediaAsset[]): Binding | null {
  if (!assets.some((asset) => asset.caption)) return null;
  // La liste illustrée : celle dont le plus d'éléments retrouvent leur image.
  let best: { list: string; items: unknown[]; byItem: Map<number, number> } | null = null;
  for (const [list, value] of Object.entries(content)) {
    if (!Array.isArray(value) || !value.length) continue;
    const byItem = pair(value, assets);
    if (byItem.size && (!best || byItem.size > best.byItem.size)) best = { list, items: value, byItem };
  }
  if (!best) return null;

  const { list, items, byItem } = best;
  const matchedItems = items.map((_, index) => index).filter((index) => byItem.has(index));
  const otherItems = items.map((_, index) => index).filter((index) => !byItem.has(index));
  const used = new Set(byItem.values());
  // Pour les éléments sans image : seulement des images sans légende, qui ne montrent personne en particulier.
  const loose = assets.map((asset, index) => ({ asset, index })).filter((a) => !a.asset.caption && !used.has(a.index));
  const orderedAssets = [...matchedItems.map((index) => assets[byItem.get(index)!]), ...loose.slice(0, otherItems.length).map((a) => a.asset)];
  const orderedItems = [...matchedItems, ...otherItems].map((index) => items[index]);
  const dropped = assets.filter((asset, index) => asset.caption && !used.has(index)).length;
  const changed =
    orderedItems.some((item, index) => item !== items[index]) ||
    orderedAssets.length !== assets.length ||
    orderedAssets.some((asset, index) => asset !== assets[index]);
  return { content: { ...content, [list]: orderedItems }, assets: orderedAssets, list, matched: byItem.size, dropped, changed };
}
