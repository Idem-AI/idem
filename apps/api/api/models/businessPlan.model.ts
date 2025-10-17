import { SectionModel } from "./section.model";

/**
 * @openapi
 * components:
 *   schemas:
 *     BusinessPlanModel:
 *       type: object
 *       properties:
 *         sections:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SectionModel'
 *       required:
 *         - sections
 */
export interface BusinessPlanModel {
  sections: SectionModel[];
}
