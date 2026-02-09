import { z } from 'zod';

/**
 * Common validation patterns
 */
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),

  // UUID/ID validation
  id: z.string().min(1, 'ID is required'),

  // Email validation
  email: z.string().email('Invalid email address').trim().toLowerCase(),

  // URL validation
  url: z.string().url('Invalid URL'),

  // Non-empty string
  nonEmptyString: z.string().min(1, 'This field is required').trim(),
};

/**
 * Generic ID parameter schema
 */
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

/**
 * Diagram generation schema
 */
export const diagramGenerationSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  diagramType: z.enum(['flowchart', 'sequence', 'class', 'er', 'gantt', 'useCase'], {
    errorMap: () => ({ message: 'Invalid diagram type' }),
  }),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be less than 2000 characters')
    .optional(),
});

/**
 * Branding generation schema
 */
export const brandingGenerationSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  style: z.enum(['modern', 'classic', 'minimal', 'bold', 'playful']).optional(),
  colors: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')).max(5).optional(),
  keywords: z.array(z.string().max(50)).max(10).optional(),
});

/**
 * Business plan generation schema
 */
export const businessPlanGenerationSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  industry: z.string().min(2).max(100).optional(),
  targetMarket: z.string().min(10).max(1000).optional(),
  competitors: z.array(z.string().max(100)).max(10).optional(),
});

// Type exports
export type PaginationInput = z.infer<typeof commonSchemas.pagination>;
export type DiagramGenerationInput = z.infer<typeof diagramGenerationSchema>;
export type BrandingGenerationInput = z.infer<typeof brandingGenerationSchema>;
export type BusinessPlanGenerationInput = z.infer<typeof businessPlanGenerationSchema>;
