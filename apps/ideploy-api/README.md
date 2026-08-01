# iDeploy API (Node.js + Express + TypeScript)

Node rewrite of the Laravel/Livewire iDeploy backend (`apps/ideploy`), part of a
strangler-fig migration. It shares **the same PostgreSQL database** as the
Laravel app and runs alongside it during the transition.

## Architecture

```
api/
  config/      logger, db (raw pg), prisma, redis, cors
  controllers/ HTTP handlers — no business logic, no SQL
  routes/      Express routers + validation schemas (+ swagger annotations)
  services/    business logic and SQL, team-scoped
  middleware/  auth (delegated), request validation, error handling
  ssh/         remote-execution port + real SSH adapter (see below)
  docker/      docker-compose generation
  jobs/        BullMQ workers (deployment, backup, scheduled tasks, pipeline)
  queue/       BullMQ queue registry (replaces Horizon)
  validation/  reusable Zod building blocks
  utils/       laravel-crypto (Laravel-compatible encrypt/decrypt), responses
  models/      hand-written row types
  app.ts       builds the Express app (starts nothing)
  index.ts     process entry point (workers + listen)
migrations/    versioned SQL for schema objects THIS service owns
tests/         unit / integration / contract suites + schema snapshot
prisma/        schema.prisma — INTROSPECTION ONLY, not used at runtime
```

## Architecture decisions

These four were settled deliberately. Changing one is a team decision, not a
drive-by edit.

### 1. Schema ownership is split, and additive-only

Both stacks read and write the same database, so ownership is split:

| Owner       | May change                                            |
| ----------- | ----------------------------------------------------- |
| **Laravel** | Every table and column that exists today              |
| **Node**    | New tables, and new columns on existing tables        |

Node **never alters or drops** anything Laravel created. Eloquent ignores columns
it does not know about, so additive columns are invisible to Laravel; renaming or
dropping one breaks it at runtime. New objects go through `migrations/`.

### 2. Raw SQL is the data layer. Prisma is a tool, not a runtime dependency

All queries are raw SQL over the `pg` pool. Prisma is kept **only** for
out-of-runtime use:

- `npm run prisma:introspect` — detect drift against the live schema
- its generated types as a reference when hand-writing row types

Importing `@prisma/client` in `api/**` is not allowed: two data-access styles in
one codebase means every reader has to learn both.

### 3. Input validation is declarative

Routes declare a Zod schema; `validate()` enforces it and returns a 422 with
per-field detail. Controllers receive already-validated, already-coerced input
and do not re-check it. Hand-rolled `if (!req.body?.x)` guards are being removed
as routes are touched — they were easy to forget and inconsistent in what they
returned.

```ts
export const createServerSchema = z.object({ name: resourceName, ip: hostAddress });
router.post('/', validate({ body: createServerSchema }), ctrl.create);
```

### 4. Vocabulary: `Workspace` groups, `Project` deploys

The word "project" used to mean two different things (a Laravel project
containing resources, and a deployed app in the UI). Going forward:

| Term          | Means                                                      |
| ------------- | ---------------------------------------------------------- |
| **Team**      | Billing, members, quotas                                   |
| **Workspace** | Deployment target + region + shared private network        |
| **Project**   | One deployable unit: a frontend, a backend, a database     |

A workspace is what lets several projects sit on the same server and reach each
other by hostname — the capability the V1 had and the simplified flow lost.

## Key principles

- **Auth is delegated.** The central Idem API (`apps/api`) owns authentication
  and sets an httpOnly `session` cookie. iDeploy verifies it via
  `GET {IDEM_API_URL}/auth/profile` and syncs the identity into `users` by
  `idem_uid`. Sanctum PATs remain a fallback for the programmatic API. There is
  no second auth system here.
- **Encrypted columns** (SSH keys, tokens) go through `utils/laravel-crypto.ts`,
  a port of Laravel's `Encrypter` (AES-256-CBC + HMAC). It needs the **exact
  same `APP_KEY`** as `apps/ideploy/.env`.
- **Every query is team-scoped.** A missing `team_id` filter is a cross-tenant
  data leak, not a bug.
- **Remote execution goes through a port.** Services call
  `executeRemoteCommand()` from `ssh/ssh.ts`, never the SSH adapter directly.
  That indirection is what lets tests swap in an in-memory executor.
- **Realtime = Soketi (Pusher protocol)**, same as the Laravel app.
- **Jobs = BullMQ on Redis**, replacing Horizon.

## Setup (dev)

```bash
cp .env.example .env
# Set APP_KEY to the SAME value as apps/ideploy/.env, then fill DB creds.

npm run prisma:introspect   # optional: refresh types/detect drift
npm run dev                 # http://localhost:3002  (/health, /api-docs)
```

In the dev stack this service runs as the `ideploy-api` container; see
`docker-compose.dev.yml`.

## Testing

Four levels, each answering a different question:

| Level           | Question it answers                                | Needs        |
| --------------- | -------------------------------------------------- | ------------ |
| **unit**        | Is this function correct?                          | nothing      |
| **integration** | Does this hold against the real schema?            | test DB      |
| **contract**    | Does the HTTP surface behave as promised?          | nothing      |
| **e2e**         | Does a real deployment actually work?              | local Docker |

```bash
# once, from the repository root — builds coolify_test from tests/schema.sql
./apps/ideploy-api/scripts/prepare-test-db.sh

docker compose -f docker-compose.dev.yml --env-file .env.dev \
  exec ideploy-api npm test
```

`tests/schema.sql` is a committed snapshot of the live schema, so integration
tests run against the real structure anywhere — including CI, which has no
Laravel. Refresh it with `scripts/dump-schema.sh` after Laravel migrations and
review the diff: it is the record of schema changes.

**No server is needed to test deployment logic.** Register the fake executor and
assert on the commands that would have run:

```ts
const ssh = useFakeExecutor();
ssh.on(/docker compose up/, { exitCode: 1, stderr: 'no space left on device' });

await deploy(app);

expect(ssh.ranMatching(/docker compose down/)).toBe(true); // cleaned up after failure
```

Guard rails worth knowing about:

- `truncateAll()` refuses to run unless the database name ends in `_test`.
- `setRemoteExecutor()` throws in production — a fake SSH executor in a live
  instance would make every deployment report success while doing nothing.

## Migration status

See the parity audit and phased plan for what is ported, partial or missing.
Short version: auth, the CRUD surface and a single-path deployment work; proxy
label generation, push-to-deploy, server health monitoring and the Workspace
model are the current gaps.
