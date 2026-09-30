# Authentication server (self-hosted Supabase Auth)

IDEM signs users in with the **Supabase auth server (GoTrue)**, self-hosted with Docker. Only the auth module runs: no Kong gateway, no PostgREST, no Studio. The dashboard talks to GoTrue directly (`@supabase/auth-js`), and the IDEM API turns the Supabase access token into its own `session` / `refreshToken` cookies: see [Sessions](../../apps/api/docs/SESSIONS.md).

Sign-in methods: e-mail and password (with e-mail confirmation), Google, LinkedIn.

| Service | Image | Role |
|---|---|---|
| `auth` | `supabase/gotrue:v2.197.0` | Auth API, published on `127.0.0.1:${AUTH_PORT:-9999}` |
| `auth-db` | `postgres:16-alpine` | GoTrue's own database (schema `auth`), no published port |

## Start

```bash
cd infra/supabase-auth
cp .env.example .env        # fill it in, see below
docker compose up -d
curl -s http://localhost:9999/health
```

On first start, `init/00-auth-roles.sh` creates the roles and the `auth` schema; GoTrue then applies its own migrations.

### Required values

| Variable | Value |
|---|---|
| `AUTH_PUBLIC_URL` | Public HTTPS URL of this service, e.g. `https://auth.idem.africa`. Base of e-mail links and OAuth callbacks |
| `AUTH_SITE_URL` | `https://console.idem.africa` (the only sign-in screen) |
| `AUTH_REDIRECT_ALLOW_LIST` | `https://console.idem.africa/**` (comma-separated, add dev URLs on dev instances only) |
| `AUTH_DB_PASSWORD`, `AUTH_ADMIN_PASSWORD` | `openssl rand -hex 24` each |
| `AUTH_JWT_SECRET` | `openssl rand -hex 32`. **Same value** as `SUPABASE_JWT_SECRET` in the API (Infisical, project `api`) |
| `AUTH_SMTP_*` | SMTP account used for confirmation and password e-mails |

Changing `AUTH_JWT_SECRET` later invalidates every Supabase session (IDEM cookies are not affected: they are signed by `SESSION_SECRET`).

## Reverse proxy and network

- Serve `127.0.0.1:9999` as `https://auth.idem.africa` from the host reverse proxy. The dashboard calls it from the browser (`AUTH_URL` in `apps/main-dashboard/.env`).
- The API reaches GoTrue internally: add the external network `idem-auth` to the API service of the production compose file and set `SUPABASE_AUTH_URL=http://idem-auth:9999`.

```yaml
services:
  api:
    networks: [default, idem-auth]
networks:
  idem-auth:
    external: true
```

## OAuth providers

Callback URL to declare everywhere: **`${AUTH_PUBLIC_URL}/callback`** (e.g. `https://auth.idem.africa/callback`).

- **Google** — Google Cloud console › APIs & Services › Credentials › OAuth client ID (Web application). Authorised redirect URI: the callback URL. Set `AUTH_GOOGLE_CLIENT_ID` and `AUTH_GOOGLE_SECRET`.
- **LinkedIn** — linkedin.com/developers › Create app (it must be attached to a LinkedIn company page) › *Products*: add **Sign In with LinkedIn using OpenID Connect** › *Auth*: add the callback URL (and `http://localhost:9999/callback` for development) under *Authorized redirect URLs*. Set `AUTH_LINKEDIN_CLIENT_ID` (Client ID) and `AUTH_LINKEDIN_SECRET` (Primary Client Secret). GoTrue requests `openid profile email` itself.

A provider left with `AUTH_<PROVIDER>_ENABLED=false` answers an error; the dashboard shows it as a failed sign-in.

## Importing existing accounts

Once the server runs and the API is configured, import the existing IDEM users (e-mails read from MongoDB, no password):

```bash
cd apps/api
npm run auth:import            # simulation: counts, writes nothing
npm run auth:import -- --apply # creates the accounts and stores authId
```

Users who signed in with Google keep doing so; LinkedIn is new, but an account with the same verified address is linked to the existing one. Users who had a password choose a new one with « Choose my password » on the login page. Their IDEM `uid`, projects and credits are unchanged.

## Backups

Everything the service needs is in the `auth_db_data` volume. Back it up like the other databases:

```bash
docker exec idem-auth-db pg_dump -U postgres -d auth -Fc > auth-$(date +%F).dump
```

## Upgrading

Pin the new `supabase/gotrue` tag in `docker-compose.yml`, read its release notes, then `docker compose pull auth && docker compose up -d auth`. Migrations run at start-up. Run `npm run check:auth` in `apps/api` against a dev instance before upgrading production.
