# IDEM console (main dashboard)

The signed-in application at `console.idem.africa`: projects, guided creation, the AI advisor chat, and every project deliverable (branding, business plan, pitch deck, legal documents, communication, finance, diagrams, simulations, development and deployments), plus the account and billing area.

Stack: Angular 20 (standalone components, signals, lazy routes), PrimeNG, Tailwind 4, ngx-translate (English and French at runtime). Client-side only (no SSR), served as static files by nginx.

- Translations: [docs/I18N.md](docs/I18N.md)
- Monorepo: [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md), design rules in the root [AGENTS.md](../../AGENTS.md)
- Backend: [apps/api](../api/README.md)

## Run

```bash
cp .env.development.example .env   # public Firebase web config and service URLs
npm install                        # from the repository root (npm workspaces)
npm start                          # http://localhost:4200
```

`npm start` and `npm run build` first run `mynode.js`, which reads `.env` (or the Docker environment) and writes `src/environments/environment*.ts`. For a production build, start from `.env.example`.

**Every value in `.env` ends up in the public bundle.** Only public identifiers belong there (Firebase web config, URLs, flags), never a token or a secret.

The API must run on `http://localhost:3001` (see [Getting started](../../docs/GETTING_STARTED.md)).

| Script | Role |
|---|---|
| `npm start` | Dev server on port 4200 |
| `npm run build` | Production build to `dist/main-dashboard/browser` |
| `npm run watch` | Development build in watch mode |
| `npm test` | Unit tests |
| `npm run i18n:*` | Translation workflow, see [docs/I18N.md](docs/I18N.md) |

## Authentication

Users sign in with Firebase on `/login`; the app then calls `POST /auth/sessionLogin` and from there relies only on the httpOnly `session` and `refreshToken` cookies set by the API (requests use `withCredentials`). No token is kept in JavaScript storage. Details: [apps/api/docs/SESSIONS.md](../api/docs/SESSIONS.md).

Guards (`src/app/guards`):

- `auth.guard.ts`: requires a session;
- `survey.guard.ts`: sends new users through the onboarding survey (`/welcome`);
- `guided-access.guard.ts`: gates the guided creation flow.

## Structure

```
src/app/
├── modules/
│   ├── auth/         login
│   ├── onboarding/   welcome survey
│   ├── guided/       guided project creation
│   ├── chat/         AI advisor chat
│   ├── dashboard/    projects and every project deliverable page
│   ├── account/      profile, plans, usage, payments
│   └── billing/      checkout and payment return
├── layouts/          dashboard, chat, guided, empty
├── guards/
├── shared/           services, components, models
└── app.routes.ts
public/assets/i18n/   en.json, fr.json and their split sources
```

Main routes:

| Area | Routes |
|---|---|
| Entry | `/login`, `/welcome`, `/console`, `/projects`, `/create-project`, `/guided`, `/chat`, `/chat/new` |
| Account | `/account` (overview), `/account/plans`, `/account/usage`, `/account/payments`, `/account/profile`; `/billing/checkout`, `/billing/success` |
| Project | `/project/dashboard`, `/project/branding/…`, `/project/business-cards`, `/project/business-plan/…`, `/project/pitch-deck/…`, `/project/legal-docs/…`, `/project/communication`, `/project/finance/…`, `/project/diagrams`, `/project/simulations`, `/project/advisor`, `/project/development`, `/project/ideploy`, `/project/deployments/…` |

All payment and plan pages live under `/account`; the old `/billing`, `/billing/plans`, `/settings` and `/project/profile` URLs redirect there. There is a single sidebar, the project one.

Document pages show an HTML preview; the PDF is only produced on export.

## Production

`Dockerfile/prod/Dockerfile.main-dashboard` builds the app and serves `dist/main-dashboard/browser` with nginx (`apps/main-dashboard/nginx.conf`); a `.staging` variant exists for the staging environment. The nginx image currently runs as root; see [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md).
