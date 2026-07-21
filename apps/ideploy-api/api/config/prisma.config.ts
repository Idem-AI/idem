/**
 * Prisma client against the shared iDeploy PostgreSQL database.
 *
 * The client is generated from an INTROSPECTED schema (`prisma db pull`),
 * never from hand-written migrations — the Laravel migrations remain the
 * single source of truth for the schema.
 *
 * NOTE: `@prisma/client` only exposes typed models AFTER you run
 *   `npm run prisma:introspect`
 * against a running database. Until then the client is empty (but importing
 * it still compiles).
 */
import { PrismaClient } from '@prisma/client';
import logger from './logger';

const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma as any).$on('warn', (e: { message: string }) => logger.warn('Prisma warning', { message: e.message }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma as any).$on('error', (e: { message: string }) => logger.error('Prisma error', { message: e.message }));

export default prisma;
