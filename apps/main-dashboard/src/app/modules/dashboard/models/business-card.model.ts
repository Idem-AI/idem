import { SectionModel } from './section.model';

/**
 * Cartes de visite : UN template (recto/verso) généré depuis la charte
 * graphique + N personnes. La carte d'une personne n'est jamais stockée, c'est
 * le template interpolé — modifier le template mène donc toutes les cartes à
 * jour automatiquement.
 */

export const BUSINESS_CARD_FRONT_ID = 'front';
export const BUSINESS_CARD_BACK_ID = 'back';

export type BusinessCardOrientation = 'landscape' | 'portrait';
export type BusinessCardExport = 'png' | 'pdf';
export type BusinessCardSide = 'front' | 'back';

/** Champs interpolables — clés des marqueurs `{{champ}}` du template. */
export const BUSINESS_CARD_FIELDS = [
  'fullName',
  'jobTitle',
  'email',
  'phone',
  'mobile',
  'website',
  'address',
  'linkedin',
] as const;

export type BusinessCardField = (typeof BUSINESS_CARD_FIELDS)[number];

export interface BusinessCardHolder {
  id: string;
  fullName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  address?: string;
  linkedin?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface BusinessCardTemplateMeta {
  id: string;
  name: string;
  concept: string;
  orientation: BusinessCardOrientation;
  fields: BusinessCardField[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface BusinessCardModel {
  template?: BusinessCardTemplateMeta;
  /** [recto, verso] — `data` = HTML Tailwind contenant les `{{champs}}`. */
  sections: SectionModel[];
  holders: BusinessCardHolder[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Dimensions physiques (mm) selon l'orientation. */
export const BUSINESS_CARD_SIZE_MM: Record<
  BusinessCardOrientation,
  { width: number; height: number }
> = {
  landscape: { width: 85, height: 55 },
  portrait: { width: 55, height: 85 },
};
