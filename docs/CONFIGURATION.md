# Configuration and secrets

Configuration comes from environment variables. **Secrets** (keys, tokens, passwords) are read from Google Secret Manager in production and from local `.env` files in development. Everything else is plain configuration and lives in the environment of each container.

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

## Google Secret Manager

Project: `lexis-ia`. The API, the AppGen server and the iDeploy API load their secrets at start-up, before any other module reads `process.env`.

### Naming

Each secret carries the index of the application that reads it:

```
<SECRET_ENV_PREFIX><app>--<VARIABLE>
api--MONGODB_PASSWORD     appgen--GLM_API_KEY     ideploy-api--APP_KEY
```

- Two applications that use the same value each have their own secret. Access can be revoked, and a value rotated, per application.
- `SECRET_ENV_PREFIX` (empty in production) separates environments: `staging-api--…`.
- Every secret has the labels `app=<app>` and `managed-by=idem-secrets`.

### What is a secret

The **manifest** of each back end is the single source of truth:

| Application | Manifest |
| --- | --- |
| API | `apps/api/api/config/secrets.manifest.ts` |
| AppGen server | `apps/appgen/apps/we-dev-next/src/config/secrets.manifest.ts` |
| iDeploy API | `apps/ideploy-api/api/config/secrets.manifest.ts` |

A manifest lists `required` secrets (the app refuses to start without them) and `optional` ones (a warning is logged). The loader, `secret-loader.ts`, is the same file in the three back ends; CI checks that the three copies stay identical.

### Enabling it

| Variable | Value |
| --- | --- |
| `USE_SECRET_MANAGER` | `true` in production (default when `NODE_ENV=production`), `false` locally |
| `GCP_PROJECT_ID` | `lexis-ia` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path of the service-account key mounted in the container |

A value already present in the container environment is never overwritten by Secret Manager. This allows a one-off override, but it also means a secret left in a production `.env` wins over Secret Manager: keep the SECRETS block empty in production.

### Service accounts

One per back end, each allowed to read only its own prefix (`roles/secretmanager.secretAccessor` with an IAM condition on the secret name):

| Application | Service account |
| --- | --- |
| API | `idem-api-secrets@lexis-ia.iam.gserviceaccount.com` |
| AppGen server | `idem-appgen-secrets@lexis-ia.iam.gserviceaccount.com` |
| iDeploy API | `idem-ideploy-api-secrets@lexis-ia.iam.gserviceaccount.com` |

Create or re-create them with `scripts/secrets/create-service-accounts.sh` (idempotent; `--keys-dir <dir outside the repository>` also writes the JSON keys). Vertex AI uses its own service account (`api--GCP_SA_CLIENT_EMAIL`, `api--GCP_SA_PRIVATE_KEY`), not these accounts. The self-hosted auth server is configured in `infra/supabase-auth/.env` (see its README); the API shares its JWT secret (`api--SUPABASE_JWT_SECRET`) and signs its own session cookie with `api--SESSION_SECRET`.

### Managing secrets

Run from the repository root with an authenticated `gcloud` (Node 22.18+):

```bash
npm run secrets -- plan                                  # what exists, what is missing — no write
npm run secrets -- push <app> --from <file.env>          # create/version the manifest's secrets found in the file
cat value | npm run secrets -- rotate <app> <VARIABLE>   # new version from stdin, previous versions disabled
npm run secrets -- copy <from-app> <to-app> <VARIABLE>…  # duplicate a shared value
npm run secrets -- prune                                 # delete entries no manifest declares (asks first)
```

No command ever prints a secret value. `--dry-run` simulates, `--yes` skips confirmation.

To add a secret: add it to the manifest, push its value, deploy. To remove one: remove it from the manifest, deploy, then `prune`.
