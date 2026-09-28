# Instructions for AI coding agents

Read these before changing code in this repository.

1. [AGENTS.md](../AGENTS.md): permanent design rules (design system, the single `<idem-loader>`, minimalism, illustrations, definition of done). Required before writing any screen, style or deliverable.
2. [.claude/CLAUDE.md](../.claude/CLAUDE.md): Angular and TypeScript conventions, and git rules.
3. [docs/](../docs/README.md): architecture, getting started, configuration, security, deployment, shared packages.

## The monorepo in one table

| App | Stack | Dev port | Docs |
|---|---|---|---|
| `apps/api` | Express, TypeScript, MongoDB, Redis | 3001 | [README](../apps/api/README.md), [docs](../apps/api/docs) |
| `apps/main-dashboard` | Angular 20 | 4200 | [README](../apps/main-dashboard/README.md) |
| `apps/landing` | Angular 20, SSR prerender, `@angular/localize` | 4201 | [README](../apps/landing/README.md) |
| `apps/ideploy-web` | Angular 20 | 4202 | [README](../apps/ideploy-web/README.md) |
| `apps/simulation` | Angular 22 | 4203 | [README](../apps/simulation/README.md) |
| `apps/ideploy-api` | Express, TypeScript, PostgreSQL, BullMQ | 3002 | [README](../apps/ideploy-api/README.md) |
| `apps/appgen` | React/Vite client + Express server (pnpm) | 5173 / 3000 | [README](../apps/appgen/README.md) |
| `apps/chart` | SvelteKit (pnpm) | 3000 | [README](../apps/chart/README.md) |

Shared packages live in `packages/` ([docs/PACKAGES.md](../docs/PACKAGES.md)). Node 24 (`.nvmrc`).

## Rules that are easy to break

- **Authentication** belongs to `apps/api`: httpOnly `session` and `refreshToken` cookies on `.idem.africa`. Front ends call APIs with `withCredentials` / `credentials: 'include'` and never store tokens. Satellite servers ask `GET /auth/me`. See [SESSIONS.md](../apps/api/docs/SESSIONS.md).
- **Secrets** never go in front-end environment files (they end up in public bundles) or in the repository. Back ends read them from Google Secret Manager as `<app>--<VARIABLE>`; the list is each app's `secrets.manifest.ts`. See [docs/CONFIGURATION.md](../docs/CONFIGURATION.md).
- **Billing** fails closed: if the billing check cannot answer, the action is refused.
- **User input reaching a shell, a URL fetch or a compose file** goes through the existing guards (`shellQuote`, `safe-fetch`, `render-network-guard`, `compose-policy`, `git-input`). Never build a command by concatenation.
- **Admin routes** use `requireSuperUser` / `requireAdminAccess` (API) or `requireTeamAdmin` / `requireInstanceAdmin` (iDeploy API). A team owner is not an instance admin.
- **Angular versions**: the root is Angular 20 and `apps/simulation` is Angular 22; do not add a `@angular/*` path mapping that crosses the two.
- **Deliverables** (business plan, charter, decks…): figures are computed by code, never written by the model; no empty pages; light surfaces unless the user asks otherwise.

## Git hooks

`pre-commit` scans staged files for secrets, and `pre-push` builds the apps you changed. Both print what to fix. Run `npm run check:secrets` or `npm run check:builds` by hand to reproduce. Do not bypass them with `--no-verify`.

## Commits

Do not commit unless asked, and do not add co-author or signature lines.
