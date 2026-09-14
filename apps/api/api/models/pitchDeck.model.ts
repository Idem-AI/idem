import { SectionModel } from './section.model';

/**
 * @openapi
 * components:
 *   schemas:
 *     PitchDeckModel:
 *       type: object
 *       properties:
 *         sections:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SectionModel'
 *         generatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - sections
 */
export interface PitchDeckModel {
  sections: SectionModel[];
  generatedAt?: Date;
}

/**
 * Un pitch deck du projet. Un projet en garde plusieurs — levée de fonds,
 * banque, présentation commerciale… —, dans `analysisResultModel.pitchDecks[]`.
 */
export interface PitchDeckDocument extends PitchDeckModel {
  id: string;
  /** Nom donné par l'utilisateur. */
  name?: string;
  /** Type de deck (`PitchDeck/deck-types.ts`) ; absent sur le deck historique = investisseur. */
  type?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
