# Migrations

Versioned SQL migrations for the schema objects **this service owns**.

## The ownership rule

The iDeploy database is shared with the Laravel app during the migration
(strangler-fig): both stacks read and write the same PostgreSQL instance. To
keep that safe, ownership is split and the split is not negotiable:

| Owner       | May change                                                    |
| ----------- | ------------------------------------------------------------- |
| **Laravel** | Every table and column that exists today                      |
| **Node**    | New tables, and new columns added to existing tables          |

**Node never alters or drops anything Laravel created.** Eloquent silently
ignores columns it does not know about, so additive columns are invisible to the
Laravel side and the two stacks coexist without coordination. Renaming or
dropping an existing column, by contrast, breaks Laravel at runtime.

Once Laravel is retired, this file is the place to record that Node has taken
full ownership.

## Writing a migration

```bash
npm run migrate:create -- add_workspace_columns_to_projects
```

That produces a timestamped pair of `.sql` files under `migrations/`. Migrations
are plain SQL — the same language as the rest of the data layer, so there is no
second dialect to learn and no ORM abstraction hiding what actually runs.

Every migration needs a working `down`. A migration you cannot reverse is a
migration you cannot deploy on a Friday.

## Running them

```bash
npm run migrate:status   # what would run, without running it
npm run migrate:up
npm run migrate:down     # roll back the last one
```

The connection comes from `DATABASE_URL` (set by docker compose in dev).

## Relationship to `tests/schema.sql`

`tests/schema.sql` is a **snapshot** of the live schema, used to build test
databases — it is not a migration and is never hand-edited. After adding a
migration here, or after Laravel adds one of its own, refresh it:

```bash
./scripts/dump-schema.sh    # from the repository root
```

Reviewing that diff is how schema changes stay visible to the team.
