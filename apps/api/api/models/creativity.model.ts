/**
 * La jauge de créativité, côté API : la même source que le dashboard
 * (`packages/shared-models/src/creativity`), importée par chemin relatif comme la
 * tarification (cf. `config/pricing.loader.ts`) — le prix affiché est le prix débité.
 */
export * from '../../../../packages/shared-models/src/creativity/creativity';

/**
 * La direction artistique décidée pour un document (business plan, pitch deck, charte) par les
 * agents de la jauge, enregistrée avec lui : une reprise ou une régénération ciblée la reprend,
 * pour que la page refaite ressemble à ses voisines.
 */
export interface SavedDocumentDesign {
  level: import('../../../../packages/shared-models/src/creativity/creativity').CreativityLevel;
  family?: string;
  pages: Record<string, { archetype?: string; imagePosition?: string; contentDensity?: string; layoutTension?: string }>;
}
