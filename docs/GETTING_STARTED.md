# Getting started

Run the platform on your machine. The infrastructure (MongoDB, PostgreSQL, Redis, MinIO, Mailpit, Soketi) runs in Docker; the applications run either in Docker too, or directly with npm while you work on them.

## Prerequisites

- **Node.js 24** (`.nvmrc`). The simulator (Angular 22) and several dependencies do not run on older versions.
- npm 10+, and pnpm (used by `apps/chart` and the AppGen client).
- Docker with Compose v2.

## 1. Install

```bash
git clone https://github.com/Idem-AI/idem.git && cd idem
nvm use                      # Node 24
npm install                  # workspaces + git hooks (Husky)
npm run prepare:packages     # builds @idem/shared-models and @idem/shared-auth-client
```

`npm install` also installs the git hooks: a secret scan on commit and a build check on push (see [Contributing](../CONTRIBUTING.md#git-hooks-automatic-checks)).

Some applications have their own dependencies and are not npm workspaces of the root:

```bash
(cd apps/chart && pnpm install)
(cd apps/appgen/apps/we-dev-next && npm install)
(cd apps/appgen/apps/we-dev-client && npm install)
```

## 2. Configure

```bash
cp .env.example .env.dev && ln -sf .env.dev .env      # used by docker-compose.dev.yml
cp apps/api/.env.example apps/api/.env
cp apps/ideploy-api/.env.example apps/ideploy-api/.env
cp apps/appgen/apps/we-dev-next/.env.example apps/appgen/apps/we-dev-next/.env
cp apps/appgen/apps/we-dev-client/.env.example apps/appgen/apps/we-dev-client/.env
cp apps/main-dashboard/.env.development.example apps/main-dashboard/.env
cp apps/landing/.env.development.example apps/landing/.env
cp apps/simulation/.env.development.example apps/simulation/.env
```

Each example lists only the variables its application reads. Back ends keep their secrets in a final **SECRETS** block; locally you fill it (or, for the API, put secrets in `apps/api/.env.secret`). Ask a maintainer for development credentials. See [Configuration and secrets](CONFIGURATION.md).

Front ends turn their `.env` into `src/environments/environment*.ts` on `npm start` / `npm run build` (`mynode.js` or `scripts/set-env.js`). Those generated files are git-ignored.

## 3. Run

### Everything in Docker

```bash
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.dev.yml down
```

### Infrastructure in Docker, one app with npm

```bash
docker compose -f docker-compose.dev.yml up -d mongodb redis minio postgres mailpit soketi
npm run dev:api            # or dev:dashboard, dev:landing, dev:simulation, dev:ideploy-api,
                           #    dev:ideploy-web, dev:appgen-next, dev:appgen-client, dev:chart
```

### Ports

| Service | URL |
| --- | --- |
| Main dashboard | http://localhost:4200 |
| Landing | http://localhost:4201 |
| iDeploy web | http://localhost:4202 |
| Simulator | http://localhost:4203 (npm only, not in Compose) |
| API | http://localhost:3001 (Swagger: `/api-docs`) |
| iDeploy API | http://localhost:3002 (Swagger: `/api-docs`) |
| AppGen server | http://localhost:3000 with npm, 3003 in Compose |
| AppGen client | http://localhost:5173 |
| Chart editor | http://localhost:3004 in Compose |
| MinIO console | http://localhost:9001 |
| Mailpit (captured e-mails) | http://localhost:8025 |

Infrastructure ports (27017, 5432, 6379, 9000, 1025) are bound to `127.0.0.1` only.

Sign in through the dashboard: every other app reuses its session. In development the `session` cookie is host-only on `localhost`, and all local ports share it.

## Useful commands

```bash
npm run build:all             # build everything
npm run check:builds -- --list   # which apps your branch changed
npm run check:builds          # build only what your branch changed (what the pre-push hook does)
npm run check:secrets         # scan staged changes for secrets
npm run secrets -- plan       # state of Infisical (maintainers)
./scripts/clean.sh            # remove node_modules and build outputs (lockfiles are kept)
```
