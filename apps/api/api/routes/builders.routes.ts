import { NextFunction, Request, Response, Router } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { verifyApiKey } from '../middleware/verifyApiKey';
import { rateLimitByUser } from '../middleware/rate-limit.middleware';
import { authenticate } from '../services/auth.service';
import multer from 'multer';
import { BuildersError, buildersService } from '../services/builders/builders.service';
import { storeBuilderCover } from '../services/builders/builder-cover';
import { BUILDERS_PROGRAM } from '../../../../packages/shared-models/src/builders/program';

/**
 * Idem Builders.
 *
 *  - `buildersRoutes` (`/builders`) : la vitrine et les règles, publiques (la
 *    landing) ; la candidature, pour un compte connecté (la console) ;
 *  - `buildersInternalRoutes` (`/internal/builders`) : la décision, par clé de
 *    service, appelée par le panel admin. Le panel lit la liste en base ; il ne
 *    passe ici que pour ce qui accorde un avantage ou change la vitrine.
 */

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch((error: unknown) => {
      if (error instanceof BuildersError) {
        res.status(error.status).json({ error: error.code, message: error.message });
        return;
      }
      logger.error(`builders: ${(error as Error).message}`);
      next(error);
    });
  };
}

/** L'identité de l'administrateur, transmise par le panel pour la traçabilité. */
function actor(req: Request): string {
  const header = req.headers['x-admin-email'];
  return (typeof header === 'string' ? header : 'admin').slice(0, 120);
}

// ── Public et candidat ───────────────────────────────────────────────────

export const buildersRoutes = Router();

const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

/** Trois candidatures par heure : de quoi corriger une faute, pas de quoi inonder la file. */
const applyLimit = rateLimitByUser({ windowMs: 3_600_000, maxRequests: 3, keyPrefix: 'ratelimit:builders-apply' });

buildersRoutes.get(
  '/showcase',
  handle(async (req, res) => {
    const limit = Number(req.query.limit ?? 60) || 60;
    res.set('Cache-Control', PUBLIC_CACHE).json({ program: BUILDERS_PROGRAM, builders: await buildersService.showcase(limit) });
  })
);

buildersRoutes.get(
  '/projects/:slug',
  handle(async (req, res) => {
    res.set('Cache-Control', PUBLIC_CACHE).json({ builder: await buildersService.profile(String(req.params.slug)) });
  })
);

// Le logo d'un projet ancien, enregistré en SVG dans la base. Servi comme une
// image, jamais comme un document : la politique de sécurité interdit tout
// script, au cas où le fichier serait ouvert directement.
buildersRoutes.get(
  '/projects/:slug/logo.svg',
  handle(async (req, res) => {
    const svg = await buildersService.legacyLogo(String(req.params.slug));
    res
      .set('Content-Type', 'image/svg+xml; charset=utf-8')
      .set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:")
      .set('X-Content-Type-Options', 'nosniff')
      .set('Cache-Control', PUBLIC_CACHE)
      .send(svg);
  })
);

buildersRoutes.get(
  '/me',
  authenticate,
  handle(async (req, res) => {
    res.json(await buildersService.mine((req as CustomRequest).user!.uid));
  })
);

buildersRoutes.get(
  '/eligibility/:projectId',
  authenticate,
  handle(async (req, res) => {
    res.json(await buildersService.eligibility((req as CustomRequest).user!.uid, String(req.params.projectId)));
  })
);

/** Couverture : un fichier, en mémoire, refusé au-delà de la limite avant toute lecture. */
const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BUILDERS_PROGRAM.coverMaxBytes, files: 1 },
});
const coverLimit = rateLimitByUser({ windowMs: 3_600_000, maxRequests: 15, keyPrefix: 'ratelimit:builders-cover' });

buildersRoutes.post(
  '/covers',
  authenticate,
  coverLimit,
  (req: Request, res: Response, next: NextFunction) =>
    coverUpload.single('cover')(req, res, (error: unknown) => {
      if ((error as { code?: string })?.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'COVER_TOO_HEAVY', message: 'La couverture dépasse 6 Mo.' });
        return;
      }
      next(error);
    }),
  handle(async (req, res) => {
    const file = (req as Request & { file?: { buffer: Buffer; mimetype: string; size: number } }).file;
    res.status(201).json(await storeBuilderCover((req as CustomRequest).user!.uid, file));
  })
);

buildersRoutes.post(
  '/applications',
  authenticate,
  applyLimit,
  handle(async (req, res) => {
    const application = await buildersService.apply((req as CustomRequest).user!, req.body ?? {}, {
      ipAddress: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
    res.status(201).json({ application });
  })
);

// ── Panel admin ──────────────────────────────────────────────────────────

export const buildersInternalRoutes = Router();
buildersInternalRoutes.use(verifyApiKey);

buildersInternalRoutes.post(
  '/applications/:id/approve',
  handle(async (req, res) => {
    res.json(await buildersService.approve(String(req.params.id), actor(req), { tagline: req.body?.tagline }));
  })
);

buildersInternalRoutes.post(
  '/applications/:id/reject',
  handle(async (req, res) => {
    res.json({ application: await buildersService.reject(String(req.params.id), actor(req), req.body?.reason) });
  })
);

buildersInternalRoutes.put(
  '/applications/:id/showcase',
  handle(async (req, res) => {
    res.json({ application: await buildersService.updateShowcase(String(req.params.id), req.body ?? {}) });
  })
);
