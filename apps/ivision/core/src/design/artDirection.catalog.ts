/**
 * Catalogue des directions artistiques — VUE sur le catalogue des DA du dépôt `idem-templates` (`catalog/directions`),
 * chargé par le moteur graphique (`@idem/graphic-engine`, module `directions` : en ligne, cache, instantané embarqué).
 *
 * Il n'y a plus de table ici. Les fiches sont rédigées une fois, dans le dépôt, avec leurs règles (anglais, pour les
 * prompts), leurs déclinaisons (français, montrées dans la charte), leurs interdits et leurs sources d'inspiration ; le
 * modèle n'invente aucun style, il CHOISIT une fiche et une déclinaison par champ (voir la charte, API IDEM).
 */
import { directionsSync, getDirection, selectableDirections, type DirectionNode } from '@idem/graphic-engine';
import type { ArtDirectionStyleId } from '../brand/art-direction.model';

export interface ArtDirectionStyle {
  id: ArtDirectionStyleId;
  /** Nom affiché, en anglais (il part dans les prompts). */
  name: string;
  /** L'idée du style en une phrase. */
  essence: string;
  /** À quel type de marque il convient — sert à l'agent qui choisit. */
  fitsBrands: string;
  /** Fond dominant imposé par le style. */
  surface: 'light' | 'dark' | 'either';
  /** Rayon de bordure caractéristique, en px. 0 = angles vifs assumés. */
  radius: number;
  /** Raison de l'échelle typographique (jamais < 1.25 : une échelle plate paraît inachevée). */
  typeRatio: number;
  layout: string;
  color: string;
  typography: string;
  devices: string;
  imagery: string;
  /** Fragment ajouté aux prompts de génération d'IMAGE : le rendu, jamais le sujet. */
  imagePromptModifier: string;
  imageNegativePrompt: string;
  bans: string[];
}

const DEFAULT_STYLE_ID = 'editorial';

function toStyle(d: DirectionNode): ArtDirectionStyle {
  return {
    id: d.id,
    name: d.name.en,
    essence: d.essence.en,
    fitsBrands: d.fitsBrands.en,
    surface: d.surface,
    radius: d.radius,
    typeRatio: d.typeRatio,
    layout: d.rules.layout,
    color: d.rules.color,
    typography: d.rules.typography,
    devices: d.rules.devices,
    imagery: d.rules.imagery,
    imagePromptModifier: d.image.modifier,
    imageNegativePrompt: d.image.negative,
    bans: d.bans,
  };
}

/** Toutes les fiches, sous la forme lue par les prompts. */
export function artDirectionStyles(): Record<string, ArtDirectionStyle> {
  return Object.fromEntries([...directionsSync().values()].map((d) => [d.id, toStyle(d)]));
}

/** Les identifiants du catalogue, pour valider une sortie de modèle. */
export function artDirectionStyleIds(): ArtDirectionStyleId[] {
  return [...directionsSync().keys()];
}

/**
 * Les identifiants proposés au directeur artistique : les styles à fond sombre obligatoire en sont écartés (la
 * plateforme est à surface claire, voir `design/lightSurface`).
 */
export function selectableArtDirectionStyleIds(): ArtDirectionStyleId[] {
  return selectableDirections().map((d) => d.id);
}

/**
 * Catalogue condensé injecté dans le prompt de sélection : identifiant, nom, essence, marques visées. Assez pour
 * choisir, pas assez pour noyer le prompt.
 */
export function buildStyleCatalogBrief(): string {
  return selectableDirections()
    .map((d) => `- ${d.id} — ${d.name.en}: ${d.essence.en} Fits: ${d.fitsBrands.en}`)
    .join('\n');
}

/** Style du catalogue, ou repli éditorial si l'identifiant est inconnu/absent. */
export function resolveStyle(id?: string | null): ArtDirectionStyle {
  const d = getDirection(id) ?? getDirection(DEFAULT_STYLE_ID) ?? [...directionsSync().values()][0];
  return toStyle(d);
}

