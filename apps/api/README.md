# IDEM API

The central back end of IDEM. It owns identity and sessions, projects and every generated deliverable, AI generation, PDF and image rendering, billing and payments. Every IDEM application talks to it, directly or through its own back end.

Express + TypeScript, MongoDB (Mongoose), Redis, MinIO, headless Chromium (Puppeteer) and several LLM providers.

## Run it

```bash
cp .env.example .env          # fill the SECRETS block, or put secrets in .env.secret
npm run dev                   # http://localhost:3001 — Swagger on /api-docs
```

It needs MongoDB, Redis and MinIO: start them with `docker compose -f docker-compose.dev.yml up -d mongodb redis minio` from the repository root. See [Getting started](../../docs/GETTING_STARTED.md) and [Configuration and secrets](../../docs/CONFIGURATION.md).

In production every variable of the Infisical project `api` is loaded before anything else ([`api/config/secrets.manifest.ts`](api/config/secrets.manifest.ts) lists the required and expected ones); the production configuration template is [`.env.production.example`](.env.production.example).

## Layout

```
api/
  index.ts        boot: secrets → Express app → MongoDB, MinIO, Chromium, Redis, billing scheduler
  config/         AI models and providers, secrets, CORS, MongoDB, Redis, MinIO, pricing loader
  middleware/     security headers, rate limits, billing (credits), quotas, policy acceptance, super user
  routes/         one router per domain (Swagger annotations inline)
  controllers/    HTTP layer: parse, call a service, shape the response
  services/       business logic, one folder per product area
  schemas/        Mongoose schemas;  models/ plain types;  repository/ generic data access
  utils/          crypto, safe fetch, render network guard, profile shaping…
  scripts/        verification scripts run by `npm run check:*`
docs/             design documents (below)
public/assets/    static assets, including the social-network mockup templates
```

## Domains and routes

| Area | Mount point | Service folder |
| --- | --- | --- |
| Sessions, profile, SSO for iDeploy | `/auth` | `auth.service.ts`, `sessionCookie.service.ts`, `refreshToken.service.ts` |
| Projects | `/projects` | `project.service.ts` |
| Brand identity (logos, palettes, typography, charter, mockups) | `/project/brandings`, `/api/logo`, `/fonts` | `BandIdentity/`, `logo-import.service.ts`, `font-*` |
| Business plan | `/project/businessPlans` | `BusinessPlan/` |
| Financial forecasts | `/project/finance` | `Finance/` |
| Pitch deck | `/project/pitchDecks` | `PitchDeck/` |
| Legal documents | `/project/legalDocs` | `LegalDocs/` |
| Diagrams | `/project/diagrams` | `Diagrams/` |
| Business cards | `/project/business-cards` | `BandIdentity/businessCard*` |
| Communication plans and flyers | `/project/communication` | `Communication/` |
| Advisor (chat) and onboarding questions | `/project/advisor`, `/project/onboarding` | `Advisor/`, `Onboarding/` |
| Simulator | `/project/simulations` | `Simulation/` |
| Infrastructure deployments (Terraform, legacy) | `/project/deployments` | `Deployment/` |
| Coherence between deliverables, project context | `/project/coherence`, `/project/context` | `coherence/`, `context-engine/`, `history/` |
| Development configuration, GitHub push | `/project/developments`, `/github` | `Development/`, `github.service.ts` |
| AppGen hand-off, iDeploy read access | `/appgen`, `/api/ideploy` | `ideploy-pg.service.ts` |
| Billing, credits, payments | `/billing` | `billing/`, `payments/` |
| Admin (internal key) | `/billing/internal`, `/api/contact`, `/cache`, `/archetypes` | — |
| Metrics | `/metrics` (Prometheus) | — |

Exact paths and payloads: Swagger at `/api-docs` (development only, or `ENABLE_API_DOCS=true`).

## Checks

The API has no unit-test runner; behaviour is locked by verification scripts that exercise real services:

```bash
npm run check:all          # agents, design, fonts, rendering, page fit, quality, prompts, providers…
npm run check:billing      # billing rules
npm run check:payments     # payment state machine (check:payments:sandbox hits the pawaPay sandbox)
npm run build              # tsc
```

## Design documents

| Document | Topic |
| --- | --- |
| [Agent architecture](docs/AGENT_ARCHITECTURE.md) | How several models work together; when an agent is justified |
| [AI routing](docs/AI_ROUTING.md) | Choosing the provider and model per generation, without code changes |
| [Vertex AI](docs/VERTEX_AI.md) | Gemini billed through Google Cloud |
| [AI usage tracking](docs/AI_USAGE_TRACKING.md) | Every model call recorded, per user, project and element |
| [Tracing](docs/TRACING.md) | Following a request through the AI pipeline |
| [Context engine](docs/CONTEXT_ENGINE.md) | Giving every agent the right project data; revision history |
| [Art direction](docs/ART_DIRECTION.md) | Avoiding generic-looking visual deliverables |
| [PDF pagination](docs/PDF_PAGINATION.md) | Paginating generated documents without cut blocks |
| [Business plan inputs](docs/BUSINESS_PLAN_INPUTS.md) | Data required per business-plan type |
| [Billing](docs/BILLING.md) | Offers, credits, entitlements |
| [Payments](docs/PAYMENTS.md) | Mobile Money collection with pawaPay |
| [Sessions](docs/SESSIONS.md) | Session cookie, refresh tokens, SSO |
| [Cache](docs/CACHE.md) | What Redis caches and how it is invalidated |
| [GitHub integration](docs/GITHUB_INTEGRATION.md) | OAuth and pushing a project to GitHub |
