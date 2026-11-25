import { NextFunction, Request, Response, Router } from 'express';
import logger from '../config/logger';
import { verifyApiKey } from '../middleware/verifyApiKey';
import { BlogError, blogService } from '../services/blog.service';
import { blogPublicPagesService } from '../services/blog-public-pages.service';

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

// ── Robots et assistants IA ──────────────────────────────────────────────
//
// Servis derrière le landing (même domaine, voir apps/landing/nginx.conf) : les robots reçoivent
// les billets en HTML complet, les IA leur version Markdown et `llms.txt`. `Vary: User-Agent` :
// le landing sert la page de l'application aux visiteurs et celle-ci aux robots, sur la même adresse.

const LOCALE = /^(fr|en)$/;
const SLUG = /^[a-z0-9-]{1,80}$/;

function locale(req: Request): 'fr' | 'en' {
  const value = String(req.params.locale ?? '');
  if (!LOCALE.test(value)) throw new BlogError(404, 'NOT_FOUND', 'Langue inconnue.');
  return value as 'fr' | 'en';
}

function slug(req: Request): string {
  const value = String(req.params.slug ?? '');
  if (!SLUG.test(value)) throw new BlogError(404, 'NOT_FOUND', 'Ce billet n’existe pas.');
  return value;
}

blogRoutes.get(
  '/html/:locale',
  handle(async (req, res) => {
    const html = await blogPublicPagesService.listHtml({ ...req.query, locale: locale(req) });
    res.type('html').vary('User-Agent').set('Cache-Control', PUBLIC_CACHE).send(html);
  })
);

blogRoutes.get(
  '/html/:locale/:slug',
  handle(async (req, res) => {
    try {
      const html = await blogPublicPagesService.postHtml(locale(req), slug(req));
      res.type('html').vary('User-Agent').set('Cache-Control', PUBLIC_CACHE).send(html);
    } catch (error) {
      // Un billet absent est un vrai 404 pour un robot, pas une page vide en 200.
      if (error instanceof BlogError && error.status === 404) {
        res.status(404).type('html').set('X-Robots-Tag', 'noindex').send('<!doctype html><title>404</title><h1>404</h1>');
        return;
      }
      throw error;
    }
  })
);

blogRoutes.get(
  '/md/:locale/:slug',
  handle(async (req, res) => {
    const md = await blogPublicPagesService.postMarkdown(locale(req), slug(req));
    res.type('text/markdown; charset=utf-8').set('Cache-Control', PUBLIC_CACHE).send(md);
  })
);

blogRoutes.get(
  '/sitemap/:locale',
  handle(async (req, res) => {
    res.type('application/xml').set('Cache-Control', PUBLIC_CACHE).send(await blogPublicPagesService.sitemap(locale(req)));
  })
);

blogRoutes.get(
  '/llms.txt',
  handle(async (_req, res) => {
    res.type('text/plain; charset=utf-8').set('Cache-Control', PUBLIC_CACHE).send(await blogPublicPagesService.llmsTxt(false));
  })
);

blogRoutes.get(
  '/llms-full.txt',
  handle(async (_req, res) => {
    res.type('text/plain; charset=utf-8').set('Cache-Control', PUBLIC_CACHE).send(await blogPublicPagesService.llmsTxt(true));
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
