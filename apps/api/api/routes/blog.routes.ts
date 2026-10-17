import { NextFunction, Request, Response, Router } from 'express';
import logger from '../config/logger';
import { verifyApiKey } from '../middleware/verifyApiKey';
import { BlogError, blogService } from '../services/blog.service';

/**
 * Le blog.
 *
 *  - `blogRoutes` (`/blog`) : public, sans compte — ce que lit le landing ;
 *  - `blogInternalRoutes` (`/internal/blog`) : écriture, par clé de service,
 *    appelée par le panel admin. Le panel envoie une intention ; le rendu
 *    Markdown, l'assainissement et les règles de publication restent ici.
 */

const SITE_URL = (process.env.LANDING_URL || 'https://idem.africa').replace(/\/$/, '');

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch((error: unknown) => {
      if (error instanceof BlogError) {
        res.status(error.status).json({ error: error.code, message: error.message });
        return;
      }
      logger.error(`blog: ${(error as Error).message}`);
      next(error);
    });
  };
}

/** L'identité de l'administrateur, transmise par le panel pour la traçabilité. */
function actor(req: Request): string {
  const header = req.headers['x-admin-email'];
  return (typeof header === 'string' ? header : 'admin').slice(0, 120);
}

// ── Public ───────────────────────────────────────────────────────────────

export const blogRoutes = Router();

// Quelques minutes de cache partagé : un billet publié apparaît vite, et le
// landing ne tape pas la base à chaque visite.
const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

blogRoutes.get(
  '/posts',
  handle(async (req, res) => {
    res.set('Cache-Control', PUBLIC_CACHE).json(await blogService.listPublic(req.query));
  })
);

blogRoutes.get(
  '/rss.xml',
  handle(async (req, res) => {
    res
      .type('application/rss+xml')
      .set('Cache-Control', PUBLIC_CACHE)
      .send(await blogService.rss(req.query.locale, SITE_URL));
  })
);

blogRoutes.get(
  '/posts/:slug',
  handle(async (req, res) => {
    res.set('Cache-Control', PUBLIC_CACHE).json(await blogService.getPublic(req.query.locale, String(req.params.slug)));
  })
);

// ── Panel admin ──────────────────────────────────────────────────────────

export const blogInternalRoutes = Router();
blogInternalRoutes.use(verifyApiKey);

blogInternalRoutes.post(
  '/render',
  handle(async (req, res) => {
    const { html, toc } = blogService.render(req.body?.markdown);
    res.json({ html, toc });
  })
);

blogInternalRoutes.get(
  '/posts',
  handle(async (req, res) => {
    res.json(await blogService.listAdmin(req.query));
  })
);

blogInternalRoutes.post(
  '/posts',
  handle(async (req, res) => {
    res.status(201).json({ post: await blogService.create(req.body ?? {}, actor(req)) });
  })
);

blogInternalRoutes.get(
  '/posts/:id',
  handle(async (req, res) => {
    res.json({ post: await blogService.getAdmin(String(req.params.id)) });
  })
);

blogInternalRoutes.put(
  '/posts/:id',
  handle(async (req, res) => {
    res.json({ post: await blogService.update(String(req.params.id), req.body ?? {}, actor(req)) });
  })
);

blogInternalRoutes.post(
  '/posts/:id/publish',
  handle(async (req, res) => {
    res.json({
      post: await blogService.setStatus(String(req.params.id), 'published', actor(req), req.body?.publishedAt),
    });
  })
);

blogInternalRoutes.post(
  '/posts/:id/unpublish',
  handle(async (req, res) => {
    res.json({ post: await blogService.setStatus(String(req.params.id), 'draft', actor(req)) });
  })
);

blogInternalRoutes.delete(
  '/posts/:id',
  handle(async (req, res) => {
    await blogService.remove(String(req.params.id));
    res.json({ deleted: true });
  })
);
