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
| API | `Dockerfile.api` | Node 20 + system Chromium (PDF rendering) |
| AppGen server | `Dockerfile.appgen-server` | Node 20, entry point `dist/main.js` |
| AppGen client | `Dockerfile.appgen-client` | `vite preview` |
| iDeploy API | `Dockerfile.ideploy-api` | Node 20 |
| Main dashboard, landing, simulation, iDeploy web, chart | `Dockerfile.<app>` | nginx (static build) |

Front-end images are built with the root `.env` of the server checkout, because front-end configuration is compiled in. That file must only contain public values for them (see [front-end variables](CONFIGURATION.md#front-end-variables-are-public)).

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

## Known gaps

- `deploy-ideploy.yml` and `Dockerfile/prod/Dockerfile.ideploy` still target `apps/ideploy` (the former Laravel application), which is no longer in the repository.
- The nginx front-end images run nginx as root inside the container.
- Builds run on the production server itself; building in CI and only pulling on the server would isolate production from build load.
