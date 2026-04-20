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
