import { SectionModel } from './section.model';

/**
 * Modèle des cartes de visite d'un projet.
 *
 * Principe : l'IA génère UN template (recto + verso) dérivé de la charte
 * graphique, avec des marqueurs `{{champ}}` là où viennent les informations
 * d'une personne. Chaque « porteur » (BusinessCardHolder) n'est qu'un jeu de
 * valeurs — sa carte est le template interpolé. Modifier le template met donc
 * automatiquement à jour toutes les cartes.
 *
 * Le template est stocké dans `sections[]` (mêmes conventions que business plan
 * / pitch deck / charte) afin de réutiliser tel quel l'éditeur WYSIWYG et le
 * service d'édition de sections (`sectionEditingService`).
 */

/** Identifiants stables des deux faces (= id des sections du template). */
export const BUSINESS_CARD_FRONT_ID = 'front';
export const BUSINESS_CARD_BACK_ID = 'back';

/** Orientation de la carte (85×55 mm paysage ou 55×85 mm portrait). */
export type BusinessCardOrientation = 'landscape' | 'portrait';

/** Format de téléchargement d'une carte rendue. */
export type BusinessCardExport = 'png' | 'pdf';

/** Face rendue. */
export type BusinessCardSide = 'front' | 'back';

/**
 * Champs interpolables dans le template. Les clés sont utilisées à la fois
 * comme marqueurs (`{{fullName}}`) et comme attributs `data-field="fullName"`
 * sur le bloc qui les porte (permet de masquer les blocs vides).
 */
export const BUSINESS_CARD_FIELDS = [
  'fullName',
  'jobTitle',
  'email',
  'phone',
  'mobile',
  'website',
  'address',
  'linkedin',
  'companyName',
  'tagline',
] as const;

export type BusinessCardField = (typeof BUSINESS_CARD_FIELDS)[number];

/**
 * @openapi
 * components:
 *   schemas:
 *     BusinessCardHolder:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         fullName: { type: string }
 *         jobTitle: { type: string, nullable: true }
 *         email: { type: string, nullable: true }
 *         phone: { type: string, nullable: true }
 *         mobile: { type: string, nullable: true }
 *         website: { type: string, nullable: true }
 *         address: { type: string, nullable: true }
 *         linkedin: { type: string, nullable: true }
 *       required: [id, fullName]
 */
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
  createdAt?: Date;
  updatedAt?: Date;
}

/** Métadonnées du template généré (le HTML vit dans `sections`). */
export interface BusinessCardTemplateMeta {
  id: string;
  /** Nom court du parti pris graphique (ex: « Minimal ivoire »). */
  name: string;
  /** Explication du concept (affichée à l'utilisateur). */
  concept: string;
  orientation: BusinessCardOrientation;
  /** Champs réellement utilisés par le template → pilote le formulaire. */
  fields: BusinessCardField[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     BusinessCardModel:
 *       type: object
 *       properties:
 *         template: { type: object, nullable: true }
 *         sections:
 *           type: array
 *           items: { $ref: '#/components/schemas/SectionModel' }
 *         holders:
 *           type: array
 *           items: { $ref: '#/components/schemas/BusinessCardHolder' }
 */
export interface BusinessCardModel {
  template?: BusinessCardTemplateMeta;
  /** [recto, verso] — `data` = HTML Tailwind contenant les `{{champs}}`. */
  sections: SectionModel[];
  holders: BusinessCardHolder[];
  createdAt?: Date;
  updatedAt?: Date;
}

/** Dimensions physiques d'une carte selon l'orientation. */
export const BUSINESS_CARD_SIZE_MM: Record<
  BusinessCardOrientation,
  { width: number; height: number }
> = {
  landscape: { width: 85, height: 55 },
  portrait: { width: 55, height: 85 },
};
