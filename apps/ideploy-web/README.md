# iDeploy web

The front end of iDeploy, IDEM's deployment platform (`ideploy.idem.africa`): servers, workspaces and projects, applications, databases, one-click services, deployments with live logs, pipelines, terminals, teams and settings.

Stack: Angular 20 (standalone components, signals, `OnPush`, lazy routes), Tailwind 4, PrimeNG, `@idem/shared-styles`. It talks to [`apps/ideploy-api`](../ideploy-api/README.md) and to the IDEM API for identity. It replaces the former Laravel/Livewire interface.

## Run

```bash
npm install                                  # from the repository root (npm workspaces)
npm run start --workspace=ideploy-web        # http://localhost:4202
```

The iDeploy API (`apps/ideploy-api`), its PostgreSQL database, Soketi and the IDEM API must be running: `docker-compose.dev.yml` at the repository root starts the back-end services. Sign in on the IDEM dashboard first.

| Script | Role |
|---|---|
| `npm start` | Dev server on port 4202 |
| `npm run build` | Production build to `dist/ideploy-web/browser` |
| `npm run lint`, `npm run typecheck` | ESLint, type check |

## Configuration

`scripts/set-env.js` runs before `start` and `build` and writes `src/environments/environment*.ts`:

- development: reads the repository-root `.env.dev` (the same file `docker-compose.dev.yml` uses, so `PUSHER_APP_KEY` matches Soketi); without it, local defaults are used;
- production: reads `apps/ideploy-web/.env`, copied there by the Docker build. Variables already set in the environment win.

| Variable | Role |
|---|---|
| `IDEPLOY_API_URL`, `IDEPLOY_API_VERSION` | iDeploy API |
| `SERVICES_API_URL` | IDEM API (identity) |
| `SERVICES_DASHBOARD_URL` | IDEM dashboard (sign-in) |
| `PUSHER_APP_KEY`, `PUSHER_HOST`, `PUSHER_PORT`, `PUSHER_SCHEME` | Soketi (live logs) |

All these values end up in the public bundle: no secrets.

## Authentication

iDeploy has no login screen and keeps no token in the browser.

- Sign-in happens on the IDEM dashboard (`/login?redirect=ideploy`), which returns to `/auth/idem`.
- `/auth/idem` (`modules/auth/sso-callback`) confirms the session with `GET /auth/profile` on the IDEM API, then enters the app.
- `auth.interceptor.ts` adds `withCredentials: true` to API calls: the httpOnly `session` cookie of `.idem.africa` authenticates every request, on both the IDEM API and the iDeploy API.
- `auth.guard.ts` protects the app routes; `instance-admin.guard.ts` protects `/admin`.

Session details: [apps/api/docs/SESSIONS.md](../api/docs/SESSIONS.md).

## Structure

```
src/app/
├── modules/     one folder per area (see below)
├── layouts/
└── shared/      components, guards, interceptors, models, services (ApiService, AuthService, TourService…)
```

| Area | Routes |
|---|---|
| Overview | `/dashboard` |
| Infrastructure | `/servers`, `/servers/new`, `/servers/new/cloud`, `/servers/:uuid`, `/servers/:uuid/terminal`, `/destinations`, `/storages`, `/sources` |
| Workspaces | `/workspaces`, `/workspaces/new`, `/workspaces/:uuid`, `/new-project`, `/new-project/import`, `/new-project/guide/:id` |
| Applications | `/applications`, `/applications/:uuid` and its `security`, `pipeline`, `insights`, `deployments`, `terminal` pages, `/deployments/:uuid` |
| Data and services | `/databases`, `/databases/:type/:uuid`, `/services`, `/services/:uuid`, `/templates`, `/templates/:name` |
| Configuration | `/shared-variables`, `/tags`, `/notifications`, `/security/tokens`, `/security/keys`, `/settings` |
| Account | `/team`, `/subscription`, `/pricing` |
| Instance admin | `/admin` |

`/projects` redirects to `/workspaces`.

## Live output

Deployment logs, server set-up output and similar streams arrive over WebSockets from Soketi (Pusher protocol), for example on the `deployment.{uuid}` channel. Terminal sessions never put credentials in the WebSocket URL, which would end up in proxy logs and browser history.

## Production

`Dockerfile/prod/Dockerfile.ideploy-web` builds the app and serves it with nginx (`apps/ideploy-web/nginx.conf`). The nginx image currently runs as root; see [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md).
