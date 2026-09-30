# Configuration and secrets

Configuration comes from environment variables. **Secrets** (keys, tokens, passwords) are read from a self-hosted [Infisical](https://infisical.com) in production and from local `.env` files in development. Everything else is plain configuration and lives in the environment of each container.

## Environment files

| File | Used by | Contains |
| --- | --- | --- |
| `.env.example` → `.env.dev` | `docker-compose.dev.yml` | Development values for the whole Compose stack |
| `apps/api/.env.example` | API, local development | Configuration, then a SECRETS block |
| `apps/api/.env.production.example` | API, production | Configuration only: no secret, ever |
| `apps/ideploy-api/.env.example` | iDeploy API | Configuration, then a SECRETS block (empty in production) |
| `apps/appgen/apps/we-dev-next/.env.example` | AppGen server | Configuration, then a SECRETS block (empty in production) |
| `apps/*/.env.example`, `apps/*/.env.development.example` (front ends) | Build of each front end | Public values only (see below) |

Rules:

- Every `.env*` file except `*.example` is git-ignored, and the pre-commit hook refuses to commit one.
- An example lists only the variables the code actually reads. When you add or remove a variable, update the example in the same change.
- Tuning variables with sensible defaults are listed, without value, in the "advanced" block of each example.

### Front-end variables are public

Front-end values are compiled into the JavaScript served to every visitor. Only public values belong there: API URLs, the auth server URL, the Google Analytics measurement ID, feature flags. Never a private key, a password or an API token.

The AppGen client enforces this in `vite.config.ts`: only variables prefixed `REACT_APP_` reach the bundle.

## Infisical

A self-hosted Infisical serves the secrets of the API, the AppGen server and the iDeploy API. Each back end loads them at start-up, before any other module reads `process.env`.

| Instance | Where | Started by |
| --- | --- | --- |
| Production | `https://secrets.idem.africa` | `docker-compose.infisical.yml` (own Postgres and Redis, config in `.env.infisical`, see `.env.infisical.example`) |
| Development | `http://localhost:8085` | `docker compose -f docker-compose.dev.yml --profile secrets up -d infisical` (reuses the dev Postgres and Redis) |

### Projects and naming

One Infisical **project per back end**: `api`, `appgen`, `ideploy-api`. Secrets sit at the root path (`/`) of an environment: `prod` in production, `dev` on the local instance. A secret is named after its variable (`MONGODB_PASSWORD`, `APP_KEY`…); the project provides the isolation, so there is no prefix.

Two applications that use the same value each hold their own copy in their project. Access can be revoked, and a value rotated, per application.

### What is a secret

The **manifest** of each back end is the single source of truth:

| Application | Manifest |
| --- | --- |
| API | `apps/api/api/config/secrets.manifest.ts` |
| AppGen server | `apps/appgen/apps/we-dev-next/src/config/secrets.manifest.ts` |
| iDeploy API | `apps/ideploy-api/api/config/secrets.manifest.ts` |

A manifest lists `required` secrets (the app refuses to start without them) and `optional` ones (a warning is logged). Secrets of the project that the manifest does not declare are ignored. The loader, `secret-loader.ts`, is the same file in the three back ends; CI checks that the three copies stay identical.

### Enabling it

| Variable | Value |
| --- | --- |
| `USE_SECRET_MANAGER` | `true` in production (default when `NODE_ENV=production`), `false` locally |
| `INFISICAL_SITE_URL` | URL of the instance |
| `INFISICAL_ENVIRONMENT` | Environment slug, `prod` by default |
| `INFISICAL_PROJECT_ID` | Project of this back end |
| `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET` | Machine identity of this back end (Universal Auth) |

In production, keep `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET` in a separate root-only env file per service rather than in the shared `.env`.

A value already present in the container environment is never overwritten by Infisical. This allows a one-off override, but it also means a secret left in a production `.env` wins over Infisical: keep the SECRETS block empty in production. If Infisical cannot be read (authentication, permissions, network), the loader logs the error, then the app stops if a required secret is missing.

### Machine identities

One per back end, with the **Viewer** role on its own project only, and the server IP as trusted IP of its Universal Auth:

| Application | Identity | Project |
| --- | --- | --- |
| API | `api-runtime` | `api` |
| AppGen server | `appgen-runtime` | `appgen` |
| iDeploy API | `ideploy-api-runtime` | `ideploy-api` |

A fourth identity, `secrets-cli`, has the **Developer** role on the three projects and is only used by the command below. Vertex AI uses its own Google Cloud service account (`GCP_SA_CLIENT_EMAIL`, `GCP_SA_PRIVATE_KEY`, both in the `api` project). The self-hosted auth server is configured in `infra/supabase-auth/.env` (see its README); the API shares its JWT secret (`SUPABASE_JWT_SECRET`) and signs its own session cookie with `SESSION_SECRET`.

### Managing secrets

Run from the repository root (Node 22.18+) with the `secrets-cli` identity:

```bash
export INFISICAL_SITE_URL=https://secrets.idem.africa
export INFISICAL_ADMIN_CLIENT_ID=… INFISICAL_ADMIN_CLIENT_SECRET=…
export INFISICAL_PROJECT_ID_API=… INFISICAL_PROJECT_ID_APPGEN=… INFISICAL_PROJECT_ID_IDEPLOY_API=…

npm run secrets -- plan                                  # what exists, what is missing — no write
npm run secrets -- push <app> --from <file.env>          # create/update the manifest's secrets found in the file
cat value | npm run secrets -- rotate <app> <VARIABLE>   # new value from stdin (Infisical keeps the history)
npm run secrets -- copy <from-app> <to-app> <VARIABLE>…  # duplicate a shared value
npm run secrets -- prune [<app>]                         # delete secrets no manifest declares (asks first)
```

No command ever prints a secret value. `--environment <slug>` targets another environment (`dev` for the local instance), `--dry-run` simulates, `--yes` skips confirmation. The Infisical web interface works too, including importing a `.env` file into an environment.

To add a secret: add it to the manifest, set its value, deploy. To remove one: remove it from the manifest, deploy, then `prune`.

### Operating the production instance

- Back up the Infisical database daily (`docker exec idem-infisical-db pg_dump -U infisical infisical`), and keep `ENCRYPTION_KEY` outside the server: a backup is unreadable without it.
- Infisical must be up before a back end restarts, otherwise the API and the iDeploy API refuse to start. In an emergency, set `USE_SECRET_MANAGER=false` on a service and put its secrets back in its environment.
- To upgrade, back up, change the pinned image tag in `docker-compose.infisical.yml`, then `up -d`.
