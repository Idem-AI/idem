# IDEM landing site

The public marketing site at `idem.africa`: home page, product pages (iDev, iDeploy, simulator), pricing, premium beta access, about, contact, African market, open source, and the legal pages.

Stack: Angular 20 (standalone components, signals), `@angular/localize` for English and French, Tailwind, prerendered with Angular SSR and served as static files by nginx.

- Translations: [docs/I18N.md](docs/I18N.md)
- SEO and hreflang: [docs/SEO_I18N_GUIDE.md](docs/SEO_I18N_GUIDE.md)
- Monorepo: [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md), design rules in the root [AGENTS.md](../../AGENTS.md)

## Run

```bash
cp .env.development.example .env.development   # service URLs, Google Analytics ID
                                                # (production: .env.example → .env)
npm install                        # from the repository root (npm workspaces)
npm start                          # http://localhost:4201 (English, source locale)
npm run start:fr                   # French build of the dev server
```

`npm start` and `npm run build` first run `mynode.js`, which reads `.env.development` (development) or `.env` (production) and writes `src/environments/environment*.ts`.

**Every value in these files ends up in the public bundle.** Only public identifiers belong there (URLs, Google Analytics measurement ID, flags), never a secret.

| Script | Role |
|---|---|
| `npm start` / `npm run dev` | Dev server on port 4201 |
| `npm run start:fr`, `npm run start:en` | Dev server in one locale |
| `npm run build` | Production build (source locale) |
| `npm run build:all-locales` | Merge translations, then build `en` and `fr` |
| `npm run serve:ssr:landing` | Run the SSR server from `dist/` (port 4000) |
| `npm run i18n:*` | Translation workflow, see [docs/I18N.md](docs/I18N.md) |
| `npm test`, `npm run lint` | Karma tests, ESLint |

## Structure

```
src/app/
├── pages/        one folder per route (home, pricing, idev-page, ideploy-page, simulation-page, …)
├── components/   page sections (header, footer, hero, …)
├── shared/       shared components, services (SeoService, …), models, styles, utils
├── services/     auth.service.ts
├── app.routes.ts          client routes
└── app.routes.server.ts   every route is prerendered (RenderMode.Prerender)
src/locale/       translation sources (see I18N.md)
public/           static files, sitemaps (sitemap.xml, sitemap-en.xml, sitemap-fr.xml)
```

Routes: `/`, `/home`, `/african-market`, `/open-source`, `/pricing`, `/about`, `/contact`, `/idev`, `/simulator`, `/ideploy`, `/premium-beta`, `/privacy-policy`, `/terms-of-service`, `/beta-policy`, `/simulation-terms`, `/not-found`.

The home page tells a single story (the Verda case) in chapters; product screenshots must be final renders, never empty screens.

## Production

`Dockerfile/prod/Dockerfile.landing` builds both locales and serves them with nginx (`apps/landing/nginx.conf`):

- `/en/…` and `/fr/…` serve the prerendered pages of each locale;
- `/` serves the French build.

Known gaps:

- `src/robots.txt` is not listed in the build assets, so it is not served. Move it to `public/` to publish it.
- The nginx image runs as root; see [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md).
