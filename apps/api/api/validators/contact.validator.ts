import { z } from 'zod';

/**
 * Contact form subjects
 */
export const CONTACT_SUBJECTS = [
  'general',
  'support',
  'sales',
  'partnership',
  'bug',
  'feature',
] as const;

/**
 * Schema for contact form submission
 */
export const contactSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters')
    .trim()
    .toLowerCase(),
  company: z
    .string()
    .max(100, 'Company name must be less than 100 characters')
    .trim()
    .optional(),
  subject: z.enum(CONTACT_SUBJECTS, {
    errorMap: () => ({ message: `Subject must be one of: ${CONTACT_SUBJECTS.join(', ')}` }),
  }),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be less than 5000 characters')
    .trim(),
});

// Type exports
export type ContactInput = z.infer<typeof contactSchema>;
