/**
 * Validators Module
 * Centralized exports for all Zod validation schemas and middleware
 */

// Validation middleware
export { validate, validateQuery, validateParams } from './validate.middleware';

// Project schemas
export {
  createProjectSchema,
  updateProjectSchema,
  projectIdSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from './project.validator';

// Contact schema
export { contactSchema, CONTACT_SUBJECTS, type ContactInput } from './contact.validator';

// Common schemas
export {
  commonSchemas,
  idParamSchema,
  diagramGenerationSchema,
  brandingGenerationSchema,
  businessPlanGenerationSchema,
  type PaginationInput,
  type DiagramGenerationInput,
  type BrandingGenerationInput,
  type BusinessPlanGenerationInput,
} from './common.validator';
