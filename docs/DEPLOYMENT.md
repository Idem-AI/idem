# Deployment

Pushing to `main` deploys the applications it changed to production. iDeploy (API and web) also deploys `dev` to staging. There is no manual release step.

## Checks before code reaches GitHub

Git hooks, installed by `npm install`:

- **pre-commit**: secret scan of the staged changes (`scripts/git-hooks/check-secrets.mjs`).
- **pre-push**: build of every application changed by the pushed commits (`scripts/git-hooks/check-builds.mjs`). A failing build blocks the push.

## GitHub Actions

| Workflow | Runs on | Does |
| --- | --- | --- |
| `ci.yml` | push and PR to `main`, `dev` | Detects changed apps; Prettier and ESLint (not blocking yet); builds the iDeploy API and type-checks iDeploy web |
| `security.yml` | push and PR to `main`, `dev` | gitleaks on the pushed commits; `npm audit` fails on critical production vulnerabilities; checks the three copies of the secret loader are identical |
| `deploy-<app>.yml` | push to `main` touching that app (`ideploy-api`, `ideploy-web`: also `dev`) | Builds and deploys one application (below) |
| `docker-build-push.yml` | called by other workflows | Multi-architecture image build to GHCR |
| `smart-deploy.yml` | manual only | Legacy; replaced by the per-app workflows |

All actions are pinned to commit SHAs, and every workflow declares least-privilege `permissions`.

## How an application is deployed

Each `deploy-<app>.yml` connects to the production server over SSH and:

1. updates the repository checkout (`/root/idem`) to the pushed commit;
2. builds `Dockerfile/prod/Dockerfile.<app>` into `ghcr.io/idem-ai/<image>:<commit>` (`<commit>-staging` for staging) and pushes it;
3. sets that tag in `/root/application/docker-compose.prod.yml` (or `docker-compose.staging.yml`);
4. pulls and restarts that service only.

Rollback: set the previous image tag in the Compose file and `docker-compose up -d <service>`.

Logs: the back ends print JSON on stdout, collected by the observability stack that runs next to them (`infra/observability/docker-compose.prod.yml`). Deploying an application needs no change there. See [Observability](OBSERVABILITY.md#6-production).

Secrets are not part of the images: back ends read them from Google Secret Manager at start-up, with the service-account key mounted in the container. See [Configuration and secrets](CONFIGURATION.md).

## Dockerfiles

| Directory | Purpose |
| --- | --- |
| `Dockerfile/dev/` | Images for `docker-compose.dev.yml`: source mounted, hot reload |
| `Dockerfile/prod/` | Production images: multi-stage, no `.env` in the final image; Node back ends run as a non-root user |

Production images per application:

| Application | Dockerfile | Serves with |
| --- | --- | --- |
| API | `Dockerfile.api` | Node 20 + system Chromium (PDF rendering) |
| AppGen server | `Dockerfile.appgen-server` | Node 20, entry point `dist/main.js` |
| AppGen client | `Dockerfile.appgen-client` | `vite preview` |
| iDeploy API | `Dockerfile.ideploy-api` | Node 20 |
| Main dashboard, landing, simulation, iDeploy web, chart | `Dockerfile.<app>` | nginx (static build) |

Front-end images are built with the root `.env` of the server checkout, because front-end configuration is compiled in. That file must only contain public values for them (see [front-end variables](CONFIGURATION.md#front-end-variables-are-public)).

## Known gaps

- `deploy-ideploy.yml` and `Dockerfile/prod/Dockerfile.ideploy` still target `apps/ideploy` (the former Laravel application), which is no longer in the repository.
- The nginx front-end images run nginx as root inside the container.
- Builds run on the production server itself; building in CI and only pulling on the server would isolate production from build load.
