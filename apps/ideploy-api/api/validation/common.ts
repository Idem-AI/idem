/**
 * Reusable validation building blocks.
 *
 * Keeping these in one place means a rule like "what counts as a resource name"
 * is decided once. Route-specific schemas live next to their routes and compose
 * these.
 */
import { z } from 'zod';

/** A resource uuid as it appears in a path. */
export const uuidParam = z.object({
  uuid: z.string().min(1, 'A uuid is required.'),
});

/**
 * Human-facing resource name. Trimmed, non-empty, and bounded by the schema's
 * varchar(255) so a too-long name fails validation instead of the database.
 */
export const resourceName = z
  .string()
  .trim()
  .min(1, 'A name is required.')
  .max(255, 'A name cannot exceed 255 characters.');

/** Optional free-text description, normalised to `undefined` when blank. */
export const description = z
  .string()
  .trim()
  .max(1000, 'A description cannot exceed 1000 characters.')
  .optional()
  .transform((v) => (v === '' ? undefined : v));

/** An SSH private key in PEM form. */
export const pemPrivateKey = z
  .string()
  .trim()
  .min(1, 'The private key is required.')
  .refine(
    (v) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(v),
    'This does not look like a private key. Paste the full PEM block, including the BEGIN and END lines.'
  );

/** IPv4/IPv6 address or resolvable hostname — servers may be reached by either. */
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^([\da-fA-F]{0,4}:){2,7}[\da-fA-F]{0,4}$/;
const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;

export const hostAddress = z
  .string()
  .trim()
  .min(1, 'A host address is required.')
  .max(255)
  .refine(
    (v) => IPV4_RE.test(v) || IPV6_RE.test(v) || HOSTNAME_RE.test(v),
    'Enter a valid IP address or hostname.'
  );

/** TCP port. */
export const port = z.coerce
  .number()
  .int('A port must be a whole number.')
  .min(1, 'A port must be between 1 and 65535.')
  .max(65535, 'A port must be between 1 and 65535.');
