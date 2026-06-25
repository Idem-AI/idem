# iDeploy API (Node.js + Express + TypeScript)

Node.js rewrite of the Laravel/Livewire iDeploy backend (`apps/ideploy`), part
of the strangler-fig migration. It shares **the same PostgreSQL database** as
the Laravel app and runs alongside it during the transition.

See the full migration plan: `~/.claude/plans/au-niveau-de-ideploy-async-spring.md`.

## Architecture

```
api/
  config/      logger, db (raw pg), prisma, redis, firebase, cors
  controllers/ HTTP handlers (servers, projects, applications, deploy)
  routes/      Express routers (+ swagger annotations)
  services/    business logic (user, server, project, application, deployment, realtime)
  middleware/  auth (Firebase + team resolution), error handling
  ssh/         multiplexed SSH engine (port of ExecuteRemoteCommand/SshMultiplexingHelper)
  docker/      docker-compose generation (port of ConfigurationGenerator)
  jobs/        BullMQ workers (deployment.worker = port of ApplicationDeploymentJob)
  queue/       BullMQ queue registry + worker helper (replaces Horizon)
  utils/       laravel-crypto (Laravel-compatible encrypt/decrypt), response helpers
  models/      hand-written row types (replaced by Prisma types after introspection)
prisma/        schema.prisma (INTROSPECTION ONLY)
```

## Key principles

- **Schema is owned by Laravel.** Never write structural Prisma migrations.
  Mirror the live schema with `npm run prisma:introspect`.
- **Encrypted columns** (SSH keys, tokens) use `utils/laravel-crypto.ts`, a
  faithful port of Laravel's `Encrypter` (AES-256-CBC + HMAC). It requires the
  **exact same `APP_KEY`** as `apps/ideploy/.env`.
- **Auth = delegated** (no local auth system). The central Idem API (`apps/api`)
  owns authentication and sets an httpOnly `session` cookie. iDeploy verifies it
  by calling `GET {IDEM_API_URL}/auth/profile` (port of `IdemAuthService`) and
  syncs the identity into `users` by `idem_uid`. The frontend sends requests with
  `withCredentials`. Sanctum PATs remain a fallback for the programmatic API.
- **Realtime = Soketi (Pusher protocol)** — same as the Laravel app, so the
  Angular client uses laravel-echo + pusher-js unchanged.
- **Jobs = BullMQ on Redis** — replaces Laravel Horizon.

## Setup (dev)

```bash
cp .env.example .env
# Set APP_KEY to the SAME value as apps/ideploy/.env, fill Firebase + DB creds.

# 1. Mirror the live schema (DB must be running and migrated by Laravel):
npm run prisma:introspect

# 2. Run:
npm run dev    # http://localhost:3002  (health at /health, docs at /api-docs)
```

## Vertical slice implemented

Auth → Servers (+ SSH validate / install Docker) → Projects/Environments →
Applications → Deploy (BullMQ → docker compose over SSH → live logs on the
`deployment.{uuid}` websocket channel). This proves the full stack end-to-end.

## Verifying Laravel crypto interop

In the dev environment (with Laravel running), confirm a value encrypted by
Laravel `Crypt::encryptString()` decrypts here via `decryptString()` and
vice-versa. A round-trip + tamper-detection unit check already passes; the
cross-stack check guarantees the shared `APP_KEY` is correct.
