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

Secrets are not part of the images: back ends read them from Infisical at start-up, each with its own machine identity. See [Configuration and secrets](CONFIGURATION.md).

## Dockerfiles

| Directory | Purpose |
| --- | --- |
| `Dockerfile/dev/` | Images for `docker-compose.dev.yml`: source mounted, hot reload |
| `Dockerfile/prod/` | Production images: multi-stage, no `.env` in the final image; Node back ends run as a non-root user |

Production images per application:

| Application | Dockerfile | Serves with |
| --- | --- | --- |
| API | `Dockerfile.api` | Node 20 + system Chromium (PDF rendering) + ffmpeg; also compiles the shared engine `apps/ivision/core` |
| iVision API | `Dockerfile.ivision-api` | Node 20 + system Chromium + ffmpeg (video and visual rendering) |
| AppGen server | `Dockerfile.appgen-server` | Node 20, entry point `dist/main.js` |
| AppGen client | `Dockerfile.appgen-client` | `vite preview` |
| iDeploy API | `Dockerfile.ideploy-api` | Node 20 |
| Main dashboard, landing, simulation, iDeploy web, iVision web, chart | `Dockerfile.<app>` | nginx (static build) |

Front-end images are built with the root `.env` of the server checkout, because front-end configuration is compiled in. That file must only contain public values for them (see [front-end variables](CONFIGURATION.md#front-end-variables-are-public)).

## iVision

Two services, `ivision-api` (port 3006) and `ivision-web`, deployed by `deploy-ivision-api.yml` and `deploy-ivision-web.yml`. Before the first deployment:

1. **Shared service key.** Create `IVISION_SERVICE_KEY` (`openssl rand -hex 32`) in **both** Infisical projects, `api` and `ivision-api`. The IDEM API refuses its `/internal/ivision/*` gateway (503) without it.
2. **Infisical project `ivision-api`** with `MONGODB_PASSWORD`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `IVISION_SERVICE_KEY` (required) and `PEXELS_API_KEY`, `JAMENDO_CLIENT_ID` (optional).
3. **Non-secret configuration** of `ivision-api`: `IDEM_API_URL`, `IVISION_API_URL` (its public URL), `IVISION_ALLOWED_ORIGINS` (the iVision front and the dashboard), `MONGODB_*`, `MINIO_*` (same MongoDB and MinIO as the API).
4. **Front build** (`.env` of the server checkout): `IVISION_API_URL`, `SERVICES_API_URL`, `SERVICES_DASHBOARD_URL` — the build fails if one is missing.
5. **IDEM side.** Add the iVision front origin to the API's `CORS_ALLOWED_ORIGINS` (it reads `/auth/profile` with the session cookie) and `SERVICES_IVISION_URL` to the dashboard's `.env` (login redirect and « Ouvrir dans iVision »).
6. **Compose and domains** (done on the production server): `ivision-api` and `ivision-web` are in `/root/application/docker-compose.prod.yml`; nginx serves `ivision.idem.africa` (front) and `api-ivision.idem.africa` (API) with one Let's Encrypt certificate (`ivision.idem.africa`). The Infisical machine identity of `ivision-api` goes in `/root/application/infisical/ivision-api.env`. The workflows only swap image tags.

The IDEM API image now also compiles `apps/ivision/core`: `deploy-api.yml` runs on changes there.

## iDeploy API: processes, limits and shutdown

One image, two roles chosen by `IDEPLOY_ROLE`:

| Value | Runs |
| --- | --- |
| `all` (default) | the HTTP API and every background worker |
| `api` | the HTTP API only |
| `worker` | the background jobs only (deployments, pipelines, backups, scheduled tasks, server health, firewall) |

In production, run one `api` and one or more `worker` containers from the same image: a burst of deployments no longer slows the API, and a worker that crashes or restarts does not take the API down. Give the workers time to finish on a redeploy:

```yaml
  ideploy-worker:
    image: ghcr.io/idem-ai/ideploy-api:<tag>
    environment:
      IDEPLOY_ROLE: worker
      WORKER_CONCURRENCY_DEPLOYMENTS: 4
    stop_grace_period: 10m
```

On `SIGTERM` a process stops taking requests and jobs, lets the running jobs finish (up to `SHUTDOWN_TIMEOUT_MS`, 10 minutes by default), then closes Redis and Postgres. Docker's default grace period is 10 seconds: without `stop_grace_period`, deployments in flight are still cut off.

| Variable | Default | Effect |
| --- | --- | --- |
| `WORKER_CONCURRENCY_<QUEUE>` | in code (deployments 3, pipelines 2, databases 2, scheduler 3) | jobs one process runs at once on that queue (`DEPLOYMENTS`, `PIPELINES`, `DATABASES`, `SCHEDULER`, `SERVERS`, `FIREWALL`) |
| `DEPLOY_MAX_PER_TEAM` | 2 | deployments of one team running at once; the others wait in the queue without holding a worker |
| `DEPLOY_MAX_PER_SERVER` | 2 | deployments building on one server at once |
| `RATE_LIMIT_READ_PER_MIN` / `RATE_LIMIT_WRITE_PER_MIN` / `RATE_LIMIT_WEBHOOK_PER_MIN` | 600 / 120 / 60 | API requests per minute and per session (or token, or IP); webhooks per application. Above: `429` with `Retry-After`. |
| `IDEPLOY_DB_POOL_MAX` | 10 | Postgres connections per process; at least the total worker concurrency plus a few for requests |
| `SHUTDOWN_TIMEOUT_MS` | 600000 | how long running jobs get to finish on `SIGTERM` |

**Redis** holds every queued job. It must run with `maxmemory-policy noeviction` and persistence (`appendonly yes`): otherwise jobs are dropped under memory pressure or lost when Redis restarts. The API checks both at start-up and logs a critical line (`redis.eviction_policy`, `redis.no_persistence`) when one is missing.

## Publishing from iCode

« Mettre en ligne » in iCode sends the generated application to iDeploy, which builds it on an IDEM-managed server and gives it an address. Three hops, each with its own requirement:

```
browser (iCode) ──► AppGen server /api/ideploy/* ──► iDeploy API /api/v1/quick-deploy… ──► managed server (Traefik)
                    IDEPLOY_API_URL                  Namecheap: monapp.idem.africa   ──► A record → server IP
```

### AppGen server

| Variable | Value |
| --- | --- |
| `IDEPLOY_API_URL` | The iDeploy API. Prefer the internal Docker address (`http://ideploy-api:3002`) when both run on the same Compose network; otherwise `https://ideploy-api.idem.africa`. |

The request carries the application's files (up to 9 MB of source, more once encoded as JSON). The nginx virtual host in front of the AppGen server, and in front of the iDeploy API if `IDEPLOY_API_URL` goes through it, needs `client_max_body_size 16m;`. nginx's default (1 MB) answers `413` and the publication fails before it reaches iDeploy.

### iDeploy API

- **Database**: the `application_sources` table (code sent by iCode, no Git repository) is created by `migrate:up`, which the container runs at every start (`scripts/start-provisioned.sh`). Nothing to run by hand; check the start-up log after the first deploy.
- **Addresses `monapp.idem.africa`**: optional. Without them, applications keep the automatic `*.sslip.io` address.

| Variable | Where | Value |
| --- | --- | --- |
| `IDEPLOY_PLATFORM_DOMAIN` | container environment | `idem.africa`. Empty turns the feature off. |
| `NAMECHEAP_API_USER` | container environment | The Namecheap account's user name |
| `NAMECHEAP_USERNAME` | container environment | Same as `NAMECHEAP_API_USER` |
| `NAMECHEAP_CLIENT_IP` | container environment | Public IP the iDeploy API calls Namecheap from (`docker exec <ideploy-api container> curl -s https://api.ipify.org`) |
| `NAMECHEAP_SANDBOX` | container environment | `false` |
| `NAMECHEAP_API_KEY` | **Infisical**, project `ideploy-api`, env `prod` | Namecheap → Profile → Tools → API Access. Push it with `npm run secrets -- push ideploy-api --from <file.env>`. |

On the Namecheap side, `NAMECHEAP_CLIENT_IP` must be in the API whitelist (Profile → Tools → API Access → Whitelisted IPs). Otherwise every call is refused with `Invalid request IP`.

> Namecheap's API has no "add one record" call: every write replaces the **whole** `idem.africa` zone. iDeploy reads the zone, adds the record and writes it all back under a Redis lock. It refuses to write when the zone comes back empty, and re-reads the zone afterwards. Keep an export of the zone (Domain List → idem.africa → Advanced DNS) before enabling the feature, and do not edit the zone by hand while publications run.

### Managed server

Applications run on a server marked `idem_managed`; their `A` record points at its public IP. That server needs:

- iDeploy's Traefik proxy started (iDeploy web → server → Proxy). Traefik holds ports 80 and 443 and obtains the Let's Encrypt certificates, so those ports must be open and **not used by another web server**. If the managed server is also the host whose nginx serves `idem.africa`, nginx must hand the application hosts to Traefik, or applications must run on another server.
- `nixpacks` installed, for the back end of a complete application. iDeploy's server setup installs it.
- Docker able to pull `node:20-alpine` and `nginx:alpine` (the static build).

### Checking it works

1. Publish a site from iCode. The iDeploy API logs `event=dns.claimed host=<name>.idem.africa`.
2. `dig +short <name>.idem.africa` answers the managed server's IP.
3. The address opens over HTTPS with a valid certificate. Allow a minute for the first certificate.

| Log | Means |
| --- | --- |
| `event=dns.claim_failed reason=…` | Namecheap refused or failed. The application is online at its sslip.io address. `reason` says why (IP not whitelisted, wrong key…). |
| `event=dns.zone_mismatch alert=critical` | After a write, the zone did not hold what was expected. Compare it with the export **now**. |

To turn the addresses off, empty `IDEPLOY_PLATFORM_DOMAIN` and restart the iDeploy API. Records already created stay in the zone; delete them by hand if needed.

## CI/CD

Every service has a small `deploy-<service>.yml` that calls `.github/workflows/_service.yml`:

| Event | What happens |
| --- | --- |
| Pull request to `dev` or `main` | The image is built on a GitHub runner. Nothing is pushed: the PR shows whether it builds. |
| Push to `dev` | Built and pushed as `ghcr.io/idem-ai/<image>:<sha>-staging`. No staging deployment. |
| Push to `main` | Built and pushed as `<sha>`, then deployed: on the production server, the service's `image:` line in `/root/application/docker-compose.prod.yml` takes the new tag, then `docker compose pull` and `up -d` for that service only. |

Nothing is built on the production server any more: builds filled its disk and held the deploy lock for up to 30 minutes.

**Secrets of the repository**

| Secret | Use |
| --- | --- |
| `SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY` | The deploy step (SSH to the production server). |
| `PROD_BUILD_ENV` | The `.env` the front ends are built with. **Public values only** (addresses `SERVICES_*`, `IVISION_API_URL`, `VITE_*`, `REACT_APP_*`, flags): never a password or an API key, they would end up in a bundle. |
| `GHCR_USER`, `GHCR_TOKEN` (optional) | A token with `write:packages`. Needed while the existing ghcr.io packages are not linked to this repository (package settings → *Manage Actions access* → add `Idem-AI/idem` with *Write*). Once linked, the job's own token is enough and these can be removed. |

A service is deployed only if it is declared in `docker-compose.prod.yml`; otherwise the deploy step stops and says so. `deploy-chart.yml` builds and pushes but does not deploy: the running `idem-chart` container comes from `/root/idem/docker-compose.prod.yml`, not from the production compose file.

## Known gaps

- The nginx front-end images run nginx as root inside the container.
