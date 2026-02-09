import { SectionModel } from './section.model';

/**
 * @openapi
 * components:
 *   schemas:
 *     DiagramModel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         sections:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SectionModel'
 *       required:
 *         - sections
 */
export interface DiagramModel {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  sections: SectionModel[];
}
